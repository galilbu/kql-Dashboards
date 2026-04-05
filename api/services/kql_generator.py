"""Natural language → KQL generation via Azure OpenAI."""

import json
import time
from typing import Any

import httpx
import structlog

from config import settings
from services.log_analytics import execute_kql

log = structlog.get_logger()

# ── Schema cache ─────────────────────────────────────────────
_schema_cache: list[dict[str, Any]] | None = None
_schema_fetched_at: float = 0
_SCHEMA_CACHE_TTL = 3600  # 1 hour

SYSTEM_PROMPT = """\
You are a KQL (Kusto Query Language) expert for Azure Log Analytics / Microsoft Sentinel.
Convert natural language descriptions into valid KQL queries.

Rules:
- Only generate read queries. Never modify or delete data.
- Never use externaldata or http_request operators.
- Default time range: last 7 days using "ago(7d)" unless the user specifies otherwise.
- Prefer summarize with bin() for time-series data suitable for line charts.
- Prefer summarize count() by <dimension> for categorical data suitable for pie/bar charts.
- Use project to select only relevant columns.
- Limit results to 1000 rows maximum using "take" or "top".
- Always return valid JSON with exactly these fields:
  {{
    "kql": "the KQL query string",
    "title": "short descriptive panel title (max 60 chars)",
    "chartType": "one of: auto, line, bar, pie, table",
    "explanation": "1-2 sentence explanation of what this query does"
  }}

{schema_section}"""


async def fetch_workspace_schemas() -> list[dict[str, Any]]:
    """Fetch table names and column schemas from the workspace. Cached 1h."""
    global _schema_cache, _schema_fetched_at

    now = time.time()
    if _schema_cache is not None and (now - _schema_fetched_at) < _SCHEMA_CACHE_TTL:
        return _schema_cache

    try:
        # Get top tables by row count
        tables_result = await execute_kql(
            "union withsource=TableName * "
            "| summarize Count=count() by TableName "
            "| top 30 by Count desc"
        )
        table_names = [row[0] for row in tables_result.get("rows", [])]

        schemas: list[dict[str, Any]] = []
        for table_name in table_names[:15]:
            try:
                schema_result = await execute_kql(f"{table_name} | getschema")
                columns = [
                    {"name": row[0], "type": row[1]}
                    for row in schema_result.get("rows", [])
                ]
                schemas.append({"table": table_name, "columns": columns})
            except Exception:
                continue

        _schema_cache = schemas
        _schema_fetched_at = now
        return schemas
    except Exception as exc:
        log.warning("schema_fetch_failed", error=str(exc))
        return _schema_cache or []


def _format_schema_context(schemas: list[dict[str, Any]]) -> str:
    """Format schemas into a compact string for the prompt."""
    if not schemas:
        return (
            "Available tables and schemas: Unknown (use common Sentinel tables "
            "like SecurityEvent, SigninLogs, AuditLogs, DeviceEvents, "
            "CommonSecurityLog, AADSignInEventsBeta, etc.)"
        )
    lines = []
    for s in schemas:
        cols = ", ".join(f"{c['name']}:{c['type']}" for c in s["columns"][:20])
        if len(s["columns"]) > 20:
            cols += ", ..."
        lines.append(f"Table: {s['table']} (columns: {cols})")
    return "Available tables and their schemas:\n" + "\n".join(lines)


async def generate_kql(description: str, include_schema: bool = True) -> dict[str, str]:
    """Generate KQL from a natural language description.

    Returns {"kql", "title", "chartType", "explanation"}.
    Raises RuntimeError on configuration or API errors.
    """
    if not settings.openai_configured:
        raise RuntimeError("Azure OpenAI is not configured")

    schema_section = ""
    if include_schema:
        schemas = await fetch_workspace_schemas()
        schema_section = _format_schema_context(schemas)
    else:
        schema_section = (
            "Use common Sentinel/Log Analytics table names like "
            "SecurityEvent, SigninLogs, AuditLogs, DeviceEvents, "
            "CommonSecurityLog, etc."
        )

    system_msg = SYSTEM_PROMPT.format(schema_section=schema_section)

    endpoint = settings.AZURE_OPENAI_ENDPOINT.rstrip("/")
    deployment = settings.AZURE_OPENAI_DEPLOYMENT
    url = (
        f"{endpoint}/openai/deployments/{deployment}"
        f"/chat/completions?api-version=2024-08-01-preview"
    )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json={
                "messages": [
                    {"role": "system", "content": system_msg},
                    {
                        "role": "user",
                        "content": f"Generate a KQL query for: {description}",
                    },
                ],
                "temperature": 0.2,
                "max_tokens": 2000,
                "response_format": {"type": "json_object"},
            },
            headers={"api-key": settings.AZURE_OPENAI_API_KEY},
            timeout=30,
        )

        if resp.status_code != 200:
            detail = resp.text[:300]
            log.error("openai_api_error", status=resp.status_code, detail=detail)
            raise RuntimeError(f"Azure OpenAI error ({resp.status_code}): {detail}")

        content = resp.json()["choices"][0]["message"]["content"]

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        log.error("openai_invalid_json", content=content[:500])
        raise RuntimeError("Failed to parse generated query. Please try rephrasing.")

    # Ensure all required fields exist
    for field in ("kql", "title", "chartType", "explanation"):
        if field not in result:
            raise RuntimeError(
                f"Generated response missing '{field}'. Please try rephrasing."
            )

    return {
        "kql": result["kql"],
        "title": result["title"],
        "chartType": result["chartType"],
        "explanation": result["explanation"],
    }

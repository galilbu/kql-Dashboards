import structlog
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Any

from azure.identity import DefaultAzureCredential, ClientSecretCredential
from azure.monitor.query import LogsQueryClient, LogsQueryStatus
from azure.core.exceptions import HttpResponseError

from config import settings

logger = structlog.get_logger()


def _serialize_value(val: Any) -> str | int | float | bool | None:
    """Convert Log Analytics result values to JSON-serializable primitives."""
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, timedelta):
        return str(val)
    if isinstance(val, Decimal):
        return float(val)
    return str(val)


_client: LogsQueryClient | None = None


def _get_credential():
    """Use DefaultAzureCredential (Managed Identity in Azure, env vars / CLI locally)."""
    if settings.ENVIRONMENT == "development" and settings.CLIENT_SECRET:
        return ClientSecretCredential(
            tenant_id=settings.TENANT_ID,
            client_id=settings.CLIENT_ID,
            client_secret=settings.CLIENT_SECRET,
        )
    return DefaultAzureCredential()


def _get_client() -> LogsQueryClient:
    global _client
    if _client is None:
        _client = LogsQueryClient(credential=_get_credential())
    return _client


def _parse_column(col: Any) -> dict[str, str]:
    """Handle both LogsTableColumn objects and plain strings."""
    if isinstance(col, str):
        return {"name": col, "type": "string"}
    return {
        "name": getattr(col, "name", str(col)),
        "type": getattr(col, "column_type", "string"),
    }


def _parse_table(table: Any) -> dict[str, Any]:
    """Extract columns and rows from a LogsTable, handling version differences."""
    columns = [_parse_column(col) for col in table.columns]
    rows = [[_serialize_value(cell) for cell in row] for row in table.rows]
    return {"columns": columns, "rows": rows}


async def execute_kql(kql: str, workspace_id: str | None = None) -> dict[str, Any]:
    """Execute a KQL query against Log Analytics and return tabular results."""
    ws_id = workspace_id or settings.WORKSPACE_ID
    client = _get_client()

    try:
        response = client.query_workspace(
            workspace_id=ws_id,
            query=kql,
            timespan=timedelta(days=30),
            server_timeout=timedelta(seconds=60),
        )
    except HttpResponseError as e:
        logger.error(
            "kql_query_failed", error_code=e.error.code if e.error else "unknown"
        )
        raise

    if response.status == LogsQueryStatus.SUCCESS:
        table = response.tables[0] if response.tables else None
        if not table:
            return {"columns": [], "rows": []}
        return _parse_table(table)

    elif response.status == LogsQueryStatus.PARTIAL:
        table = response.partial_data[0] if response.partial_data else None
        if not table:
            return {"columns": [], "rows": []}
        result = _parse_table(table)
        result["partial"] = True
        return result

    else:
        raise Exception("Query failed with unknown status")

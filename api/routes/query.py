import re
import time

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from middleware.auth import AuthenticatedUser
from middleware.rbac import require_role
from services.log_analytics import execute_kql
from utils import validate_uuid

logger = structlog.get_logger()

router = APIRouter(tags=["query"])

limiter = Limiter(key_func=get_remote_address)

BLOCKED_PATTERNS = [
    r"\bexternaldata\b",
    r"\bhttp_request\b",
]


class QueryRequest(BaseModel):
    kql: str
    dashboard_id: str

    @field_validator("kql")
    @classmethod
    def validate_kql(cls, v: str) -> str:
        if len(v) > 10_000:
            raise ValueError("Query exceeds maximum length (10,000 characters)")

        if not v.strip():
            raise ValueError("Query cannot be empty")

        for pattern in BLOCKED_PATTERNS:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError("Query contains a disallowed operator")

        return v


@router.post("/query")
async def run_query(
    body: QueryRequest,
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    """Execute a KQL query. Requires viewer+ role on the dashboard."""
    validate_uuid(body.dashboard_id)

    start = time.time()
    try:
        result = await execute_kql(body.kql)
    except Exception:
        logger.error(
            "kql_query_execution_failed",
            user_oid=user.oid,
            dashboard_id=body.dashboard_id,
            query_length=len(body.kql),
        )
        raise HTTPException(status_code=500, detail="Query execution failed")

    duration_ms = int((time.time() - start) * 1000)
    logger.info(
        "kql_query_executed",
        user_oid=user.oid,
        dashboard_id=body.dashboard_id,
        query_length=len(body.kql),
        duration_ms=duration_ms,
        row_count=len(result.get("rows", [])),
    )

    return result

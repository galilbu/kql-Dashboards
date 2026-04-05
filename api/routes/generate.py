"""Natural language → KQL generation endpoint."""

import re

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from middleware.auth import AuthenticatedUser
from middleware.rbac import require_role
from routes.query import BLOCKED_PATTERNS
from services.activity_service import log_activity
from services.kql_generator import generate_kql
from config import settings
from utils import validate_uuid

logger = structlog.get_logger()

router = APIRouter(tags=["generate"])

limiter = Limiter(key_func=get_remote_address)


class GenerateRequest(BaseModel):
    description: str
    dashboard_id: str
    include_schema: bool = True

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if len(v) > 2000:
            raise ValueError("Description exceeds maximum length (2,000 characters)")
        if not v.strip():
            raise ValueError("Description cannot be empty")
        return v


class GenerateResponse(BaseModel):
    kql: str
    title: str
    chart_type: str
    explanation: str


@router.post("/generate-kql", response_model=GenerateResponse)
async def generate_kql_endpoint(
    body: GenerateRequest,
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    """Generate a KQL query from a natural language description."""
    validate_uuid(body.dashboard_id)

    if not settings.openai_configured:
        raise HTTPException(
            status_code=503,
            detail="KQL generation is not configured. Contact your administrator.",
        )

    try:
        result = await generate_kql(
            description=body.description.strip(),
            include_schema=body.include_schema,
        )
    except RuntimeError as exc:
        logger.error(
            "kql_generation_failed",
            user_oid=user.oid,
            description=body.description[:200],
            error=str(exc),
        )
        raise HTTPException(status_code=502, detail=str(exc))

    # Validate generated KQL against blocked patterns
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, result["kql"], re.IGNORECASE):
            raise HTTPException(
                status_code=422,
                detail="Generated query contains disallowed operators. "
                "Please try a different description.",
            )

    await log_activity(
        user_oid=user.oid,
        user_name=user.name,
        action="kql_generate",
        target_type="dashboard",
        target_id=body.dashboard_id,
        details=body.description[:200],
    )

    logger.info(
        "kql_generated",
        user_oid=user.oid,
        dashboard_id=body.dashboard_id,
        description_length=len(body.description),
    )

    return GenerateResponse(
        kql=result["kql"],
        title=result["title"],
        chart_type=result["chartType"],
        explanation=result["explanation"],
    )

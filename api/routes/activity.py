"""Activity log endpoints."""

from fastapi import APIRouter, Depends

from middleware.auth import AuthenticatedUser, get_current_user
from middleware.rbac import is_super_admin
from services.activity_service import list_activities

router = APIRouter()


@router.get("/activity")
async def get_activity_log(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """List recent activity. Super admins see all; regular users see their own."""
    entries = await list_activities(limit=500)

    if not is_super_admin(current_user):
        entries = [e for e in entries if e.user_oid == current_user.oid]

    return {"activities": [e.model_dump() for e in entries]}

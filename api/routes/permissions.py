from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import AuthenticatedUser
from middleware.rbac import require_role
from services.permissions_service import (
    PermissionGrant,
    grant_permission,
    revoke_permission,
    list_permissions,
)
from services.activity_service import log_activity
from utils import validate_uuid

router = APIRouter(tags=["permissions"])


@router.get("/dashboards/{dashboard_id}/permissions")
async def get_dashboard_permissions(
    dashboard_id: str,
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    validate_uuid(dashboard_id)
    permissions = await list_permissions(dashboard_id)
    return {"permissions": [p.model_dump() for p in permissions]}


@router.post("/dashboards/{dashboard_id}/permissions")
async def add_dashboard_permission(
    dashboard_id: str,
    body: PermissionGrant,
    user: AuthenticatedUser = Depends(require_role("admin")),
):
    validate_uuid(dashboard_id)

    if body.role not in ("viewer", "editor", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    permission = await grant_permission(
        dashboard_id=dashboard_id,
        user_oid=body.user_oid,
        role=body.role,
        granted_by=user.oid,
    )

    await log_activity(
        user_oid=user.oid,
        user_name=user.name,
        action="permission_grant",
        target_type="permission",
        target_id=dashboard_id,
        target_name=body.user_oid,
        details=f"role={body.role}",
    )

    return permission.model_dump()


@router.delete("/dashboards/{dashboard_id}/permissions/{user_oid}")
async def remove_dashboard_permission(
    dashboard_id: str,
    user_oid: str,
    user: AuthenticatedUser = Depends(require_role("admin")),
):
    validate_uuid(dashboard_id)

    deleted = await revoke_permission(dashboard_id, user_oid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Permission not found")

    await log_activity(
        user_oid=user.oid,
        user_name=user.name,
        action="permission_revoke",
        target_type="permission",
        target_id=dashboard_id,
        target_name=user_oid,
    )

    return {"detail": "Permission revoked"}

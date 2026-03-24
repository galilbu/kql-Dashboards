from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import AuthenticatedUser, get_current_user
from middleware.rbac import is_super_admin, require_role
from services.dashboard_service import (
    DashboardCreate,
    DashboardUpdate,
    create_dashboard,
    get_dashboard,
    update_dashboard,
    delete_dashboard,
    list_all_dashboards,
    list_dashboards_for_user,
)
from services.permissions_service import (
    grant_permission,
    list_user_dashboard_ids,
    list_permissions,
    revoke_permission,
)
from utils import validate_uuid

router = APIRouter(tags=["dashboards"])


@router.get("/dashboards")
async def list_dashboards(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List all dashboards the current user has access to. Super admins see all."""
    if is_super_admin(user.oid):
        dashboards = await list_all_dashboards()
    else:
        dashboard_ids = await list_user_dashboard_ids(user.oid)
        dashboards = await list_dashboards_for_user(dashboard_ids)
    return {"dashboards": [d.model_dump() for d in dashboards]}


@router.post("/dashboards", status_code=201)
async def create_new_dashboard(
    body: DashboardCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Create a new dashboard. The creator is automatically granted admin role."""
    dashboard = await create_dashboard(body, user.oid)

    # Auto-grant admin to creator
    await grant_permission(
        dashboard_id=dashboard.id,
        user_oid=user.oid,
        role="admin",
        granted_by=user.oid,
    )

    return dashboard.model_dump()


@router.get("/dashboards/{dashboard_id}")
async def get_single_dashboard(
    dashboard_id: str,
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    """Get a single dashboard by ID. Requires viewer+ role."""
    validate_uuid(dashboard_id)
    dashboard = await get_dashboard(dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=403, detail="Forbidden")
    return dashboard.model_dump()


@router.put("/dashboards/{dashboard_id}")
async def update_existing_dashboard(
    dashboard_id: str,
    body: DashboardUpdate,
    user: AuthenticatedUser = Depends(require_role("editor")),
):
    """Update a dashboard. Requires editor+ role."""
    validate_uuid(dashboard_id)
    dashboard = await update_dashboard(dashboard_id, body)
    if not dashboard:
        raise HTTPException(status_code=403, detail="Forbidden")
    return dashboard.model_dump()


@router.delete("/dashboards/{dashboard_id}")
async def delete_existing_dashboard(
    dashboard_id: str,
    user: AuthenticatedUser = Depends(require_role("admin")),
):
    """Delete a dashboard. Requires admin role."""
    validate_uuid(dashboard_id)

    # Delete all permissions for this dashboard
    permissions = await list_permissions(dashboard_id)
    for p in permissions:
        await revoke_permission(dashboard_id, p.user_oid)

    deleted = await delete_dashboard(dashboard_id)
    if not deleted:
        raise HTTPException(status_code=403, detail="Forbidden")

    return {"detail": "Dashboard deleted"}

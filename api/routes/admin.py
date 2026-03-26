"""Admin routes — super admins only.

GET  /api/admin/users        — list all local users
GET  /api/admin/permissions   — list all permissions across all dashboards
DELETE /api/admin/users/:id   — delete a local user
GET  /api/users/me/permissions — current user's permissions (any user)
"""

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import AuthenticatedUser, get_current_user
from middleware.rbac import is_super_admin
from services.local_auth_service import get_table_client
from services.permissions_service import (
    list_permissions,
    list_user_dashboard_ids,
    revoke_permission,
)
from services.dashboard_service import list_all_dashboards, list_dashboards_for_user

router = APIRouter(tags=["admin"])


@router.get("/admin/users")
async def list_local_users(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List all local users. Super admins only."""
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Forbidden")

    client = get_table_client("LocalUsers")
    users = []
    for e in client.list_entities():
        users.append(
            {
                "id": e["RowKey"],
                "email": e.get("email", ""),
                "display_name": e.get("display_name", ""),
                "created_at": e.get("created_at", ""),
            }
        )
    return {"users": users}


@router.delete("/admin/users/{user_id}")
async def delete_local_user(
    user_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Delete a local user and revoke all their permissions. Super admins only."""
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Forbidden")

    if user_id == user.oid:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Delete from LocalUsers table
    client = get_table_client("LocalUsers")
    try:
        client.delete_entity(partition_key="user", row_key=user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    # Revoke all permissions for this user
    dashboard_ids = await list_user_dashboard_ids(user_id)
    for did in dashboard_ids:
        await revoke_permission(did, user_id)

    return {"detail": "User deleted"}


@router.get("/admin/permissions")
async def list_all_permissions(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List all permissions across all dashboards. Super admins only."""
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Forbidden")

    dashboards = await list_all_dashboards()
    result = []
    for d in dashboards:
        perms = await list_permissions(d.id)
        for p in perms:
            result.append(
                {
                    "dashboard_id": d.id,
                    "dashboard_title": d.title,
                    "user_oid": p.user_oid,
                    "role": p.role,
                    "granted_by": p.granted_by,
                    "granted_at": p.granted_at,
                }
            )
    return {"permissions": result}


@router.get("/users/me/permissions")
async def get_my_permissions(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get current user's permissions across all dashboards."""
    dashboard_ids = await list_user_dashboard_ids(user.oid)
    if not dashboard_ids:
        return {"permissions": []}

    dashboards = await list_dashboards_for_user(dashboard_ids)
    dashboard_map = {d.id: d.title for d in dashboards}

    from services.permissions_service import get_user_permission

    result = []
    for did in dashboard_ids:
        perm = await get_user_permission(did, user.oid)
        if perm:
            result.append(
                {
                    "dashboard_id": did,
                    "dashboard_title": dashboard_map.get(did, "Unknown"),
                    "role": perm.role,
                }
            )
    return {"permissions": result}

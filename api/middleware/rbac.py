from fastapi import Depends, HTTPException

from middleware.auth import AuthenticatedUser, get_current_user

ROLE_RANK = {"viewer": 1, "editor": 2, "admin": 3}


def require_role(min_role: str):
    """Returns a FastAPI dependency that checks the user has at least min_role on the given dashboard.

    The dashboard_id is extracted from the path parameter at request time.
    """

    async def dependency(
        dashboard_id: str,
        user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        from services.permissions_service import get_user_permission

        permission = await get_user_permission(dashboard_id, user.oid)

        if not permission or ROLE_RANK.get(permission.role, 0) < ROLE_RANK[min_role]:
            raise HTTPException(status_code=403, detail="Forbidden")

        return user

    return dependency

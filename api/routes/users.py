from fastapi import APIRouter, Depends, Query

from middleware.auth import AuthenticatedUser, get_current_user
from services.graph_service import search_users

router = APIRouter(tags=["users"])


@router.get("/users/search")
async def search_tenant_users(
    q: str = Query(..., min_length=2, max_length=100, description="Search query"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    results = await search_users(q)
    return {"users": results}

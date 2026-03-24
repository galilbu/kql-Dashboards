from typing import Optional

import httpx

from config import settings


async def _get_app_token() -> str:
    """Get an app-only access token for MS Graph using client credentials."""
    url = f"https://login.microsoftonline.com/{settings.TENANT_ID}/oauth2/v2.0/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": settings.CLIENT_ID,
        "client_secret": settings.CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, data=data)
        response.raise_for_status()
        return response.json()["access_token"]


async def search_users(query: str, limit: int = 10) -> list[dict]:
    """Search Entra ID users by display name or UPN."""
    if not query or len(query) < 2:
        return []

    token = await _get_app_token()

    url = "https://graph.microsoft.com/v1.0/users"
    params = {
        "$filter": f"startswith(displayName, '{query}') or startswith(userPrincipalName, '{query}')",
        "$top": str(limit),
        "$select": "id,displayName,userPrincipalName,mail",
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "ConsistencyLevel": "eventual",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()

    return [
        {
            "oid": u["id"],
            "display_name": u.get("displayName", ""),
            "upn": u.get("userPrincipalName", ""),
            "email": u.get("mail", ""),
        }
        for u in data.get("value", [])
    ]

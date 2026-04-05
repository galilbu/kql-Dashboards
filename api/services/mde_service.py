"""Microsoft Defender for Endpoint API integration.

Uses the MDE API (api.securitycenter.microsoft.com) to:
- Find machines by device name
- Isolate / unisolate machines

Requires an Entra ID app registration with the MDE API permission:
  Machine.Isolate, Machine.Read.All

Set these env vars:
  MDE_TENANT_ID, MDE_CLIENT_ID, MDE_CLIENT_SECRET
(falls back to the app's TENANT_ID/CLIENT_ID/CLIENT_SECRET if not set)
"""

from typing import Optional

import httpx
import structlog

from config import settings

log = structlog.get_logger()

MDE_API_BASE = "https://api.securitycenter.microsoft.com/api"
MDE_SCOPE = "https://api.securitycenter.microsoft.com/.default"


async def _get_mde_token() -> str:
    """Get an OAuth2 token for the MDE API using client credentials flow."""
    tenant_id = settings.MDE_TENANT_ID or settings.TENANT_ID
    client_id = settings.MDE_CLIENT_ID or settings.CLIENT_ID
    client_secret = settings.MDE_CLIENT_SECRET or settings.CLIENT_SECRET

    if not all([tenant_id, client_id, client_secret]):
        raise RuntimeError("MDE credentials not configured")

    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
                "scope": MDE_SCOPE,
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def find_machine_id(device_name: str) -> Optional[str]:
    """Look up a machine ID by device name. Returns None if not found."""
    try:
        token = await _get_mde_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{MDE_API_BASE}/machines",
                params={"$filter": f"computerDnsName eq '{device_name}'"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            resp.raise_for_status()
            machines = resp.json().get("value", [])

            if not machines:
                # Try case-insensitive partial match
                resp = await client.get(
                    f"{MDE_API_BASE}/machines",
                    params={"$filter": f"contains(computerDnsName, '{device_name}')"},
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30,
                )
                resp.raise_for_status()
                machines = resp.json().get("value", [])

            if machines:
                return machines[0]["id"]
            return None
    except Exception as exc:
        log.error("mde_find_machine_failed", device=device_name, error=str(exc))
        return None


async def isolate_machine(machine_id: str, comment: str) -> dict[str, object]:
    """Isolate a machine. Returns {"success": bool, "message": str}."""
    try:
        token = await _get_mde_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{MDE_API_BASE}/machines/{machine_id}/isolate",
                json={"Comment": comment, "IsolationType": "Full"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            if resp.status_code in (200, 201):
                return {
                    "success": True,
                    "message": "Machine isolation initiated successfully",
                }
            else:
                detail = resp.json().get("error", {}).get("message", resp.text)
                log.error(
                    "mde_isolate_failed",
                    machine_id=machine_id,
                    status=resp.status_code,
                    detail=detail,
                )
                return {"success": False, "message": f"MDE error: {detail}"}
    except Exception as exc:
        log.error("mde_isolate_error", machine_id=machine_id, error=str(exc))
        return {"success": False, "message": str(exc)}


async def unisolate_machine(machine_id: str, comment: str) -> dict[str, object]:
    """Release a machine from isolation."""
    try:
        token = await _get_mde_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{MDE_API_BASE}/machines/{machine_id}/unisolate",
                json={"Comment": comment},
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            if resp.status_code in (200, 201):
                return {
                    "success": True,
                    "message": "Machine release initiated successfully",
                }
            else:
                detail = resp.json().get("error", {}).get("message", resp.text)
                log.error(
                    "mde_unisolate_failed",
                    machine_id=machine_id,
                    status=resp.status_code,
                    detail=detail,
                )
                return {"success": False, "message": f"MDE error: {detail}"}
    except Exception as exc:
        log.error("mde_unisolate_error", machine_id=machine_id, error=str(exc))
        return {"success": False, "message": str(exc)}

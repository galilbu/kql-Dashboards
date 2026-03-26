import time
from typing import Optional

import httpx
from fastapi import HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel

from config import settings


class AuthenticatedUser(BaseModel):
    oid: str
    tid: str
    name: str = ""
    preferred_username: str = ""


# JWKS cache
_jwks_cache: Optional[dict] = None
_jwks_fetched_at: float = 0
_JWKS_CACHE_TTL = 86400  # 24 hours


async def _get_jwks() -> dict:
    """Fetch and cache Entra ID JWKS keys."""
    global _jwks_cache, _jwks_fetched_at

    now = time.time()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_CACHE_TTL:
        return _jwks_cache

    jwks_url = (
        f"https://login.microsoftonline.com/{settings.TENANT_ID}/discovery/v2.0/keys"
    )
    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_url)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_fetched_at = now
        return _jwks_cache


async def _validate_entra_token(token: str) -> dict:
    """Validate JWT token against Entra ID JWKS."""
    jwks = await _get_jwks()

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token header")

    rsa_key = {}
    for key in jwks.get("keys", []):
        if key["kid"] == unverified_header.get("kid"):
            rsa_key = key
            break

    if not rsa_key:
        raise HTTPException(status_code=401, detail="Unable to find signing key")

    try:
        claims = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.CLIENT_ID,
            issuer=f"https://login.microsoftonline.com/{settings.TENANT_ID}/v2.0",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if claims.get("tid") != settings.TENANT_ID:
        raise HTTPException(status_code=401, detail="Token from wrong tenant")

    return claims


def _validate_local_token(token: str) -> dict:
    """Validate a locally-issued HS256 JWT."""
    if not settings.LOCAL_JWT_SECRET:
        raise HTTPException(status_code=401, detail="Local auth is not configured")
    from services.local_auth_service import decode_local_jwt
    try:
        return decode_local_jwt(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired local token")


async def get_current_user(request: Request) -> AuthenticatedUser:
    """FastAPI dependency — extract and validate the authenticated user.

    Supports two token types:
    - Entra ID JWTs (RS256, validated against JWKS)
    - Local JWTs    (HS256, validated with LOCAL_JWT_SECRET)
    """

    # DEV ONLY — bypass
    if settings.ENVIRONMENT == "development":
        dev_oid = request.headers.get("X-Dev-User-OID")
        if dev_oid:
            return AuthenticatedUser(
                oid=dev_oid,
                tid="dev-tenant",
                name="Dev User",
                preferred_username="dev@localhost",
            )

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid authorization header"
        )

    token = auth_header.removeprefix("Bearer ")

    # Peek at issuer without verifying signature to route to the right validator
    try:
        unverified = jwt.get_unverified_claims(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    from services.local_auth_service import LOCAL_ISSUER

    if unverified.get("iss") == LOCAL_ISSUER:
        claims = _validate_local_token(token)
        return AuthenticatedUser(
            oid=claims["sub"],
            tid="local",
            name=claims.get("name", ""),
            preferred_username=claims.get("email", ""),
        )

    # Fall through to Entra validation
    claims = await _validate_entra_token(token)
    return AuthenticatedUser(
        oid=claims["oid"],
        tid=claims["tid"],
        name=claims.get("name", ""),
        preferred_username=claims.get("preferred_username", ""),
    )

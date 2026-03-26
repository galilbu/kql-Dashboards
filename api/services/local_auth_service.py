"""Local (invite-based) authentication service.

Manages two Azure Table Storage tables:
  - LocalUsers   — registered local accounts
  - LocalInvites — single-use invite tokens created by super admins
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

import hashlib
import os

from jose import JWTError, jwt
from pydantic import BaseModel

from config import settings
from services.table_storage import get_table_client

_USERS_TABLE = "LocalUsers"
_INVITES_TABLE = "LocalInvites"
_INVITE_TTL_DAYS = 7
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRY_HOURS = 8

LOCAL_ISSUER = "kql-dashboard-local"


# ── Models ────────────────────────────────────────────────────────────────────


class LocalUser(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: str


class LocalInvite(BaseModel):
    token: str
    created_by: str  # OID of the super admin who created it
    created_at: str
    expires_at: str
    used: bool = False


# ── Password helpers ──────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    """PBKDF2-SHA256 with a random salt, 260 000 iterations (OWASP 2023)."""
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260_000)
    return salt.hex() + ":" + key.hex()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        salt_hex, key_hex = hashed.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, 260_000)
        return key.hex() == key_hex
    except Exception:
        return False


# ── JWT helpers ───────────────────────────────────────────────────────────────


def create_local_jwt(user: LocalUser) -> str:
    """Issue a signed JWT for a local user."""
    now = datetime.now(timezone.utc)
    claims = {
        "iss": LOCAL_ISSUER,
        "sub": user.id,
        "email": user.email,
        "name": user.display_name,
        "iat": now,
        "exp": now + timedelta(hours=_JWT_EXPIRY_HOURS),
    }
    return jwt.encode(claims, settings.LOCAL_JWT_SECRET, algorithm=_JWT_ALGORITHM)


def decode_local_jwt(token: str) -> dict:
    """Validate and decode a local JWT. Raises JWTError on failure."""
    return jwt.decode(
        token,
        settings.LOCAL_JWT_SECRET,
        algorithms=[_JWT_ALGORITHM],
        issuer=LOCAL_ISSUER,
    )


# ── LocalUsers table ─────────────────────────────────────────────────────────


async def get_user_by_email(email: str) -> LocalUser | None:
    client = get_table_client(_USERS_TABLE)
    try:
        entities = list(
            client.query_entities(f"email eq '{email.lower()}'")
        )
        if not entities:
            return None
        e = entities[0]
        return LocalUser(
            id=e["RowKey"],
            email=e["email"],
            display_name=e["display_name"],
            created_at=e["created_at"],
        )
    except Exception:
        return None


async def get_user_by_id(user_id: str) -> LocalUser | None:
    client = get_table_client(_USERS_TABLE)
    try:
        e = client.get_entity(partition_key="user", row_key=user_id)
        return LocalUser(
            id=e["RowKey"],
            email=e["email"],
            display_name=e["display_name"],
            created_at=e["created_at"],
        )
    except Exception:
        return None


async def create_user(email: str, display_name: str, password: str) -> LocalUser:
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    client = get_table_client(_USERS_TABLE)
    client.create_entity({
        "PartitionKey": "user",
        "RowKey": user_id,
        "email": email.lower(),
        "display_name": display_name,
        "password_hash": hash_password(password),
        "created_at": now,
    })
    return LocalUser(id=user_id, email=email.lower(), display_name=display_name, created_at=now)


async def verify_user_password(email: str, password: str) -> LocalUser | None:
    """Return the user if credentials are correct, else None."""
    client = get_table_client(_USERS_TABLE)
    try:
        entities = list(client.query_entities(f"email eq '{email.lower()}'"))
        if not entities:
            return None
        e = entities[0]
        if not verify_password(password, e.get("password_hash", "")):
            return None
        return LocalUser(
            id=e["RowKey"],
            email=e["email"],
            display_name=e["display_name"],
            created_at=e["created_at"],
        )
    except Exception:
        return None


async def count_local_users() -> int:
    """Return the total number of registered local users."""
    client = get_table_client(_USERS_TABLE)
    try:
        return sum(1 for _ in client.list_entities())
    except Exception:
        return 0


# ── LocalInvites table ────────────────────────────────────────────────────────


async def create_invite(created_by: str) -> LocalInvite:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=_INVITE_TTL_DAYS)
    client = get_table_client(_INVITES_TABLE)
    client.create_entity({
        "PartitionKey": "invite",
        "RowKey": token,
        "created_by": created_by,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "used": False,
    })
    return LocalInvite(
        token=token,
        created_by=created_by,
        created_at=now.isoformat(),
        expires_at=expires_at.isoformat(),
        used=False,
    )


async def get_invite(token: str) -> LocalInvite | None:
    client = get_table_client(_INVITES_TABLE)
    try:
        e = client.get_entity(partition_key="invite", row_key=token)
        return LocalInvite(
            token=e["RowKey"],
            created_by=e["created_by"],
            created_at=e["created_at"],
            expires_at=e["expires_at"],
            used=e.get("used", False),
        )
    except Exception:
        return None


async def consume_invite(token: str) -> None:
    """Mark an invite as used."""
    client = get_table_client(_INVITES_TABLE)
    client.update_entity(
        {"PartitionKey": "invite", "RowKey": token, "used": True},
        mode="merge",
    )

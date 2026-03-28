"""Local invite-based authentication routes.

POST /api/auth/invite    — super admin creates a single-use invite link
POST /api/auth/register  — user registers via invite token
POST /api/auth/login     — user logs in with email + password
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator

from config import settings
from middleware.auth import AuthenticatedUser, get_current_user
from middleware.rbac import is_super_admin
from services.local_auth_service import (
    consume_invite,
    count_local_users,
    create_invite,
    create_local_jwt,
    create_user,
    get_invite,
    get_user_by_email,
    verify_user_password,
)

router = APIRouter(tags=["auth"])


# ── Request / response models ──────────────────────────────────────────────────


class InviteRequest(BaseModel):
    email: str = ""
    frontend_origin: str = ""  # e.g. https://my-app.com


class InviteResponse(BaseModel):
    token: str
    expires_at: str
    email_sent: bool = False


class RegisterRequest(BaseModel):
    invite_token: str
    email: EmailStr
    display_name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("display_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Display name cannot be empty")
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    display_name: str
    email: str
    is_super_admin: bool


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post("/api/auth/invite", response_model=InviteResponse)
async def create_invite_link(
    body: InviteRequest = InviteRequest(),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Generate a single-use invite link. Optionally sends it via email."""
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=403, detail="Only super admins can create invite links"
        )

    if not settings.LOCAL_JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Local auth is not configured (LOCAL_JWT_SECRET is missing)",
        )

    invite = await create_invite(created_by=current_user.oid)

    email_sent = False
    if body.email and body.frontend_origin:
        from services.email_service import send_invite_email

        invite_url = f"{body.frontend_origin.rstrip('/')}/register?token={invite.token}"
        email_sent = await send_invite_email(body.email, invite_url)

    return InviteResponse(
        token=invite.token, expires_at=invite.expires_at, email_sent=email_sent
    )


@router.post("/api/auth/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    """Register a new local user via an invite token.

    If no local users exist yet, the invite token is not required — this
    allows bootstrapping the first super admin account.
    """
    if not settings.LOCAL_JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Local auth is not configured (LOCAL_JWT_SECRET is missing)",
        )

    user_count = await count_local_users()
    is_bootstrap = user_count == 0  # first ever registration — no invite needed

    if not is_bootstrap:
        # Validate invite token
        invite = await get_invite(body.invite_token)
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid invite token")
        if invite.used:
            raise HTTPException(
                status_code=400, detail="Invite token has already been used"
            )
        expires_at = datetime.fromisoformat(invite.expires_at)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=400, detail="Invite token has expired")

    # Check email uniqueness
    existing = await get_user_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=409, detail="An account with this email already exists"
        )

    user = await create_user(
        email=str(body.email),
        display_name=body.display_name,
        password=body.password,
    )

    if not is_bootstrap:
        await consume_invite(body.invite_token)

    token = create_local_jwt(user)
    super_admin = user.email in settings.local_super_admin_list

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        display_name=user.display_name,
        email=user.email,
        is_super_admin=super_admin,
    )


@router.post("/api/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Authenticate with email and password, return a JWT."""
    if not settings.LOCAL_JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Local auth is not configured (LOCAL_JWT_SECRET is missing)",
        )

    user = await verify_user_password(str(body.email), body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_local_jwt(user)
    super_admin = user.email in settings.local_super_admin_list

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        display_name=user.display_name,
        email=user.email,
        is_super_admin=super_admin,
    )

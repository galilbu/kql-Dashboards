"""Device actions — isolate / release via Microsoft Defender for Endpoint.

High-risk actions require OTP email verification before execution.
Flow: 1) POST /actions/otp/send  →  user receives code via email
      2) POST /actions/device    →  must include valid OTP code
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.auth import AuthenticatedUser, get_current_user
from services.activity_service import log_activity
from services.email_service import send_invite_email
from services.mde_service import isolate_machine, unisolate_machine, find_machine_id
from services.otp_service import create_otp, verify_otp
from services.table_storage import get_table_client
from config import settings

router = APIRouter(tags=["actions"])


# ── Models ────────────────────────────────────────────────────


class OtpSendRequest(BaseModel):
    device_name: str
    action: str  # "isolate" or "release"


class OtpSendResponse(BaseModel):
    sent: bool
    message: str


class DeviceActionRequest(BaseModel):
    device_name: str
    action: str  # "isolate" or "release"
    comment: str = ""
    otp_code: str = ""


class DeviceActionResponse(BaseModel):
    success: bool
    device_name: str
    action: str
    message: str


# ── OTP endpoints ─────────────────────────────────────────────


@router.post("/actions/otp/send", response_model=OtpSendResponse)
async def send_action_otp(
    body: OtpSendRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Send an OTP code to the logged-in user's email for action verification."""
    device_name = body.device_name.strip()
    if not device_name:
        raise HTTPException(status_code=400, detail="Device name is required")
    if body.action not in ("isolate", "release"):
        raise HTTPException(
            status_code=400, detail="Action must be 'isolate' or 'release'"
        )

    if not settings.smtp_configured:
        raise HTTPException(
            status_code=503,
            detail="Email is not configured. Cannot send OTP.",
        )

    # Get the user's email (preferred_username from the token)
    user_email = user.preferred_username
    if not user_email:
        raise HTTPException(
            status_code=400,
            detail="Cannot determine your email address from your account.",
        )

    # Create OTP
    code = await create_otp(
        user_oid=user.oid,
        action=body.action,
        target=device_name,
    )

    # Send OTP email (reuse SMTP infrastructure)
    action_label = "ISOLATE" if body.action == "isolate" else "RELEASE"
    await _send_otp_email(user_email, code, action_label, device_name)

    return OtpSendResponse(
        sent=True,
        message=f"Verification code sent to {_mask_email(user_email)}",
    )


# ── Device action (requires OTP) ─────────────────────────────


@router.post("/actions/device", response_model=DeviceActionResponse)
async def execute_device_action(
    body: DeviceActionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Isolate or release a machine via MDE. Requires OTP verification."""
    device_name = body.device_name.strip()
    if not device_name:
        raise HTTPException(status_code=400, detail="Device name is required")

    if body.action not in ("isolate", "release"):
        raise HTTPException(
            status_code=400, detail="Action must be 'isolate' or 'release'"
        )

    # ── OTP verification ──
    if not body.otp_code:
        raise HTTPException(
            status_code=400,
            detail="OTP verification code is required. "
            "Call POST /actions/otp/send first.",
        )

    code = body.otp_code.strip()

    # Try exact device target first (single-device flow, consumed on use)
    otp_valid = await verify_otp(
        user_oid=user.oid,
        action=body.action,
        target=device_name,
        code=code,
    )
    if not otp_valid:
        # Try bulk OTP — not consumed so it can be reused for multiple devices
        from services.otp_service import verify_otp as _verify

        # Search for any bulk-* OTP for this user+action
        try:
            table = get_table_client("ActionOTP")
            for entity in table.query_entities(f"PartitionKey eq '{user.oid}'"):
                rk = entity.get("RowKey", "")
                if rk.startswith(f"{body.action}_bulk-"):
                    otp_valid = await _verify(
                        user_oid=user.oid,
                        action=body.action,
                        target=rk.split(f"{body.action}_", 1)[1],
                        code=code,
                        consume=False,
                    )
                    if otp_valid:
                        break
        except Exception:
            pass

    if not otp_valid:
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired verification code. Please request a new one.",
        )

    comment = body.comment or f"{body.action} requested by {user.name}"

    # Look up the machine ID from device name
    machine_id = await find_machine_id(device_name)
    if not machine_id:
        raise HTTPException(
            status_code=404,
            detail=f"Device '{device_name}' not found in Microsoft Defender",
        )

    # Execute the action
    if body.action == "isolate":
        result = await isolate_machine(machine_id, comment)
    else:
        result = await unisolate_machine(machine_id, comment)

    if not result["success"]:
        raise HTTPException(status_code=502, detail=result["message"])

    await log_activity(
        user_oid=user.oid,
        user_name=user.name,
        action=f"device_{body.action}",
        target_type="device",
        target_id=machine_id,
        target_name=device_name,
        details=comment,
    )

    return DeviceActionResponse(
        success=True,
        device_name=device_name,
        action=body.action,
        message=result["message"],
    )


# ── Helpers ───────────────────────────────────────────────────


def _mask_email(email: str) -> str:
    """Mask an email for display: t***@company.com."""
    parts = email.split("@")
    if len(parts) != 2 or len(parts[0]) < 2:
        return "***"
    return f"{parts[0][0]}***@{parts[1]}"


async def _send_otp_email(to_email: str, code: str, action: str, device: str) -> bool:
    """Send OTP verification email using existing SMTP service."""
    import smtplib
    import ssl
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    from_addr = settings.SMTP_FROM or settings.SMTP_USER

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"SOC Portal — Verify {action} action"
    msg["From"] = from_addr
    msg["To"] = to_email

    text_body = (
        f"SOC Portal Action Verification\n\n"
        f"Action: {action} device {device}\n\n"
        f"Your verification code: {code}\n\n"
        f"This code expires in 5 minutes.\n"
        f"If you did not request this action, ignore this email."
    )

    html_body = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <span style="color: #13C636; font-size: 20px; font-weight: 700;">SOC Portal</span>
  </div>
  <p style="color: #333; font-size: 15px; line-height: 1.6;">Action verification required:</p>
  <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
    <p style="color: #666; font-size: 13px; margin: 0 0 4px;">
      {action} device <strong>{device}</strong>
    </p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <div style="display: inline-block; padding: 16px 40px; background-color: #111128;
                border-radius: 8px; letter-spacing: 8px; font-size: 28px;
                font-weight: 700; color: #13C636; font-family: monospace;">
      {code}
    </div>
  </div>
  <p style="color: #888; font-size: 13px; line-height: 1.5; text-align: center;">
    This code expires in <strong>5 minutes</strong>.<br />
    If you did not request this action, ignore this email.
  </p>
</div>"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.SMTP_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(
                settings.SMTP_HOST, settings.SMTP_PORT, context=context
            ) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        return True
    except Exception:
        return False

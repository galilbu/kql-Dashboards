"""One-time password service for verifying high-risk actions.

OTPs are stored in Azure Table Storage with a 5-minute TTL.
Each OTP is single-use and tied to a specific user + action.
"""

import secrets
import string
from datetime import datetime, timezone, timedelta

import structlog

from services.table_storage import get_table_client

log = structlog.get_logger()

TABLE_NAME = "ActionOTP"
OTP_LENGTH = 6
OTP_TTL_MINUTES = 5


def _generate_code() -> str:
    """Generate a 6-digit numeric OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(OTP_LENGTH))


async def create_otp(user_oid: str, action: str, target: str) -> str:
    """Create and store an OTP. Returns the code to send to the user."""
    table = get_table_client(TABLE_NAME)
    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)

    # PartitionKey = user_oid, RowKey = action_target for easy lookup
    row_key = f"{action}_{target}"

    # Upsert — overwrites any existing OTP for this user+action+target
    table.upsert_entity(
        {
            "PartitionKey": user_oid,
            "RowKey": row_key,
            "code": code,
            "expires_at": expires_at.isoformat(),
            "used": False,
        }
    )

    log.info("otp_created", user_oid=user_oid, action=action, target=target)
    return code


async def verify_otp(
    user_oid: str, action: str, target: str, code: str, consume: bool = True
) -> bool:
    """Verify an OTP. Returns True if valid, False otherwise.

    Args:
        consume: If True (default), the OTP is marked as used after verification.
                 Set to False for bulk operations where the same OTP is reused.
    """
    table = get_table_client(TABLE_NAME)
    row_key = f"{action}_{target}"

    try:
        entity = table.get_entity(partition_key=user_oid, row_key=row_key)
    except Exception:
        log.warning("otp_not_found", user_oid=user_oid, action=action)
        return False

    # Check if already used
    if entity.get("used"):
        log.warning("otp_already_used", user_oid=user_oid, action=action)
        return False

    # Check expiry
    expires_at = datetime.fromisoformat(entity["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        log.warning("otp_expired", user_oid=user_oid, action=action)
        return False

    # Check code
    if entity["code"] != code:
        log.warning("otp_invalid_code", user_oid=user_oid, action=action)
        return False

    if consume:
        entity["used"] = True
        table.update_entity(entity)

    log.info("otp_verified", user_oid=user_oid, action=action, target=target)
    return True

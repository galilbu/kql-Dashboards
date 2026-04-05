"""Activity log service — tracks user actions in Azure Table Storage."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel

from services.table_storage import get_table_client

TABLE_NAME = "ActivityLog"


class ActivityEntry(BaseModel):
    id: str
    timestamp: str
    user_oid: str
    user_name: str
    action: str  # e.g. dashboard_create, permission_grant, device_isolate
    target_type: str  # e.g. dashboard, user, device
    target_id: str
    target_name: str
    details: str


async def log_activity(
    *,
    user_oid: str,
    user_name: str,
    action: str,
    target_type: str = "",
    target_id: str = "",
    target_name: str = "",
    details: str = "",
) -> None:
    """Write an activity entry. Fire-and-forget — errors are silently ignored."""
    try:
        table = get_table_client(TABLE_NAME)
        now = datetime.now(timezone.utc)
        # PartitionKey = date (YYYY-MM-DD) for efficient range queries
        # RowKey = reverse-timestamp + uuid for descending order
        reverse_ts = str(9999999999 - int(now.timestamp()))
        row_key = f"{reverse_ts}_{uuid.uuid4().hex[:8]}"

        table.create_entity(
            {
                "PartitionKey": now.strftime("%Y-%m-%d"),
                "RowKey": row_key,
                "timestamp_iso": now.isoformat(),
                "user_oid": user_oid,
                "user_name": user_name,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "target_name": target_name,
                "details": details,
            }
        )
    except Exception:
        pass  # Activity logging should never break the main flow


async def list_activities(limit: int = 200) -> list[ActivityEntry]:
    """Return recent activity entries in reverse chronological order."""
    table = get_table_client(TABLE_NAME)
    entries: list[ActivityEntry] = []

    # Query all partitions, newest first (RowKey is reverse-timestamp)
    for entity in table.list_entities():
        entries.append(
            ActivityEntry(
                id=entity["RowKey"],
                timestamp=entity.get("timestamp_iso", ""),
                user_oid=entity.get("user_oid", ""),
                user_name=entity.get("user_name", ""),
                action=entity.get("action", ""),
                target_type=entity.get("target_type", ""),
                target_id=entity.get("target_id", ""),
                target_name=entity.get("target_name", ""),
                details=entity.get("details", ""),
            )
        )
        if len(entries) >= limit:
            break

    return entries

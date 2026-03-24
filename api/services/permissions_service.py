from datetime import datetime, timezone
from typing import Optional

from azure.core.exceptions import ResourceNotFoundError
from pydantic import BaseModel

from services.table_storage import get_table_client

TABLE_NAME = "DashboardPermissions"


class Permission(BaseModel):
    dashboard_id: str
    user_oid: str
    role: str
    granted_by: str
    granted_at: str


class PermissionGrant(BaseModel):
    user_oid: str
    role: str


def _entity_to_permission(entity: dict) -> Permission:
    return Permission(
        dashboard_id=entity["PartitionKey"],
        user_oid=entity["RowKey"],
        role=entity.get("role", "viewer"),
        granted_by=entity.get("granted_by", ""),
        granted_at=entity.get("granted_at", ""),
    )


async def get_user_permission(dashboard_id: str, user_oid: str) -> Optional[Permission]:
    table = get_table_client(TABLE_NAME)
    try:
        entity = table.get_entity(partition_key=dashboard_id, row_key=user_oid)
        return _entity_to_permission(entity)
    except ResourceNotFoundError:
        return None


async def grant_permission(
    dashboard_id: str, user_oid: str, role: str, granted_by: str
) -> Permission:
    table = get_table_client(TABLE_NAME)
    now = datetime.now(timezone.utc).isoformat()

    entity = {
        "PartitionKey": dashboard_id,
        "RowKey": user_oid,
        "role": role,
        "granted_by": granted_by,
        "granted_at": now,
    }
    table.upsert_entity(entity)
    return _entity_to_permission(entity)


async def revoke_permission(dashboard_id: str, user_oid: str) -> bool:
    table = get_table_client(TABLE_NAME)
    try:
        table.delete_entity(partition_key=dashboard_id, row_key=user_oid)
        return True
    except ResourceNotFoundError:
        return False


async def list_permissions(dashboard_id: str) -> list[Permission]:
    table = get_table_client(TABLE_NAME)
    entities = table.query_entities(f"PartitionKey eq '{dashboard_id}'")
    return [_entity_to_permission(e) for e in entities]


async def list_user_dashboard_ids(user_oid: str) -> list[str]:
    """Get all dashboard IDs a user has access to."""
    table = get_table_client(TABLE_NAME)
    entities = table.query_entities(f"RowKey eq '{user_oid}'")
    return [e["PartitionKey"] for e in entities]

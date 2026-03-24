import uuid
from datetime import datetime, timezone
from typing import Optional

from azure.core.exceptions import ResourceNotFoundError
from pydantic import BaseModel

from services.table_storage import get_table_client

TABLE_NAME = "Dashboards"


class Dashboard(BaseModel):
    id: str
    title: str
    description: str = ""
    panels: str = "[]"  # JSON-serialized panel config
    created_by: str
    created_at: str
    updated_at: str


class DashboardCreate(BaseModel):
    title: str
    description: str = ""


class DashboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    panels: Optional[str] = None


def _entity_to_dashboard(entity: dict) -> Dashboard:
    return Dashboard(
        id=entity["RowKey"],
        title=entity.get("title", ""),
        description=entity.get("description", ""),
        panels=entity.get("panels", "[]"),
        created_by=entity.get("created_by", ""),
        created_at=entity.get("created_at", ""),
        updated_at=entity.get("updated_at", ""),
    )


async def create_dashboard(data: DashboardCreate, user_oid: str) -> Dashboard:
    table = get_table_client(TABLE_NAME)
    dashboard_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    entity = {
        "PartitionKey": "dashboard",
        "RowKey": dashboard_id,
        "title": data.title,
        "description": data.description,
        "panels": "[]",
        "created_by": user_oid,
        "created_at": now,
        "updated_at": now,
    }
    table.create_entity(entity)
    return _entity_to_dashboard(entity)


async def get_dashboard(dashboard_id: str) -> Optional[Dashboard]:
    table = get_table_client(TABLE_NAME)
    try:
        entity = table.get_entity(partition_key="dashboard", row_key=dashboard_id)
        return _entity_to_dashboard(entity)
    except ResourceNotFoundError:
        return None


async def update_dashboard(dashboard_id: str, data: DashboardUpdate) -> Optional[Dashboard]:
    table = get_table_client(TABLE_NAME)
    try:
        entity = table.get_entity(partition_key="dashboard", row_key=dashboard_id)
    except ResourceNotFoundError:
        return None

    now = datetime.now(timezone.utc).isoformat()

    if data.title is not None:
        entity["title"] = data.title
    if data.description is not None:
        entity["description"] = data.description
    if data.panels is not None:
        entity["panels"] = data.panels
    entity["updated_at"] = now

    table.update_entity(entity, mode="merge")
    return _entity_to_dashboard(entity)


async def delete_dashboard(dashboard_id: str) -> bool:
    table = get_table_client(TABLE_NAME)
    try:
        table.delete_entity(partition_key="dashboard", row_key=dashboard_id)
        return True
    except ResourceNotFoundError:
        return False


async def list_dashboards_for_user(dashboard_ids: list[str]) -> list[Dashboard]:
    """List dashboards by a list of IDs (from permissions lookup)."""
    if not dashboard_ids:
        return []

    table = get_table_client(TABLE_NAME)
    dashboards = []
    for did in dashboard_ids:
        try:
            entity = table.get_entity(partition_key="dashboard", row_key=did)
            dashboards.append(_entity_to_dashboard(entity))
        except ResourceNotFoundError:
            continue
    return dashboards

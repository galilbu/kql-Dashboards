import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from services.dashboard_service import (
    DashboardCreate,
    DashboardUpdate,
    create_dashboard,
    get_dashboard,
    update_dashboard,
    delete_dashboard,
)


@pytest.fixture
def mock_table():
    with patch("services.dashboard_service.get_table_client") as mock:
        table = MagicMock()
        mock.return_value = table
        yield table


@pytest.mark.asyncio
async def test_create_dashboard_generates_uuid(mock_table):
    data = DashboardCreate(title="Security Overview")
    result = await create_dashboard(data, "user-oid-1")

    assert result.title == "Security Overview"
    assert result.created_by == "user-oid-1"
    assert len(result.id) == 36  # UUID format
    mock_table.create_entity.assert_called_once()


@pytest.mark.asyncio
async def test_get_dashboard_returns_entity(mock_table):
    mock_table.get_entity.return_value = {
        "PartitionKey": "dashboard",
        "RowKey": "abc-123",
        "title": "Test",
        "description": "desc",
        "panels": "[]",
        "created_by": "user-1",
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00",
    }
    result = await get_dashboard("abc-123")
    assert result is not None
    assert result.title == "Test"
    assert result.id == "abc-123"


@pytest.mark.asyncio
async def test_update_dashboard_merges_fields(mock_table):
    mock_table.get_entity.return_value = {
        "PartitionKey": "dashboard",
        "RowKey": "abc-123",
        "title": "Old Title",
        "description": "old",
        "panels": "[]",
        "created_by": "user-1",
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00",
    }
    data = DashboardUpdate(title="New Title")
    result = await update_dashboard("abc-123", data)

    assert result is not None
    assert result.title == "New Title"
    assert result.description == "old"  # unchanged
    mock_table.update_entity.assert_called_once()


@pytest.mark.asyncio
async def test_delete_dashboard_success(mock_table):
    result = await delete_dashboard("abc-123")
    assert result is True
    mock_table.delete_entity.assert_called_once()


@pytest.mark.asyncio
async def test_delete_dashboard_not_found(mock_table):
    from azure.core.exceptions import ResourceNotFoundError
    mock_table.delete_entity.side_effect = ResourceNotFoundError("Not found")
    result = await delete_dashboard("abc-123")
    assert result is False

import pytest
from unittest.mock import patch, MagicMock

from services.dashboard_service import DashboardCreate, create_dashboard, get_dashboard
from services.permissions_service import get_user_permission, grant_permission


@pytest.fixture
def mock_table():
    with patch("services.table_storage.get_table_client") as mock:
        table = MagicMock()
        mock.return_value = table
        yield table


@pytest.mark.asyncio
async def test_create_dashboard(mock_table):
    """Creating a dashboard should call create_entity with correct fields."""
    with patch("services.dashboard_service.get_table_client", return_value=mock_table):
        data = DashboardCreate(title="Test Dashboard", description="A test")
        result = await create_dashboard(data, "user-oid-123")

    assert result.title == "Test Dashboard"
    assert result.description == "A test"
    assert result.created_by == "user-oid-123"
    mock_table.create_entity.assert_called_once()


@pytest.mark.asyncio
async def test_get_dashboard_not_found(mock_table):
    """Getting a non-existent dashboard should return None."""
    from azure.core.exceptions import ResourceNotFoundError

    mock_table.get_entity.side_effect = ResourceNotFoundError("Not found")

    with patch("services.dashboard_service.get_table_client", return_value=mock_table):
        result = await get_dashboard("non-existent-id")

    assert result is None


@pytest.mark.asyncio
async def test_grant_permission(mock_table):
    """Granting a permission should upsert the entity."""
    with patch("services.permissions_service.get_table_client", return_value=mock_table):
        result = await grant_permission("dash-1", "user-1", "editor", "admin-1")

    assert result.dashboard_id == "dash-1"
    assert result.user_oid == "user-1"
    assert result.role == "editor"
    mock_table.upsert_entity.assert_called_once()


@pytest.mark.asyncio
async def test_get_user_permission_not_found(mock_table):
    """Getting a non-existent permission should return None."""
    from azure.core.exceptions import ResourceNotFoundError

    mock_table.get_entity.side_effect = ResourceNotFoundError("Not found")

    with patch("services.permissions_service.get_table_client", return_value=mock_table):
        result = await get_user_permission("dash-1", "user-1")

    assert result is None

import pytest
from unittest.mock import patch

from services.permissions_service import grant_permission, revoke_permission, list_permissions


@pytest.fixture
def mock_table():
    with patch("services.permissions_service.get_table_client") as mock:
        from unittest.mock import MagicMock
        table = MagicMock()
        mock.return_value = table
        yield table


@pytest.mark.asyncio
async def test_grant_permission_creates_entity(mock_table):
    result = await grant_permission("dash-1", "user-1", "editor", "admin-1")
    assert result.role == "editor"
    assert result.granted_by == "admin-1"
    mock_table.upsert_entity.assert_called_once()


@pytest.mark.asyncio
async def test_revoke_permission_success(mock_table):
    result = await revoke_permission("dash-1", "user-1")
    assert result is True
    mock_table.delete_entity.assert_called_once()


@pytest.mark.asyncio
async def test_revoke_permission_not_found(mock_table):
    from azure.core.exceptions import ResourceNotFoundError
    mock_table.delete_entity.side_effect = ResourceNotFoundError("Not found")
    result = await revoke_permission("dash-1", "user-1")
    assert result is False


@pytest.mark.asyncio
async def test_list_permissions(mock_table):
    mock_table.query_entities.return_value = [
        {
            "PartitionKey": "dash-1",
            "RowKey": "user-1",
            "role": "editor",
            "granted_by": "admin-1",
            "granted_at": "2024-01-01T00:00:00",
        }
    ]
    result = await list_permissions("dash-1")
    assert len(result) == 1
    assert result[0].role == "editor"

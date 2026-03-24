import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from middleware.auth import get_current_user


@pytest.fixture
def mock_request():
    request = MagicMock()
    request.headers = {}
    return request


@pytest.mark.asyncio
async def test_dev_bypass_returns_dev_user(mock_request):
    """In development mode, X-Dev-User-OID header should bypass token validation."""
    mock_request.headers = {"X-Dev-User-OID": "test-oid-123"}

    with patch("middleware.auth.settings") as mock_settings:
        mock_settings.ENVIRONMENT = "development"
        user = await get_current_user(mock_request)

    assert user.oid == "test-oid-123"
    assert user.name == "Dev User"


@pytest.mark.asyncio
async def test_missing_auth_header_returns_401(mock_request):
    """Requests without Authorization header should get 401."""
    mock_request.headers = {}

    with patch("middleware.auth.settings") as mock_settings:
        mock_settings.ENVIRONMENT = "production"
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_request)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_invalid_bearer_prefix_returns_401(mock_request):
    """Authorization header without Bearer prefix should get 401."""
    mock_request.headers = {"Authorization": "Basic abc123"}

    with patch("middleware.auth.settings") as mock_settings:
        mock_settings.ENVIRONMENT = "production"
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_request)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_dev_bypass_disabled_in_production(mock_request):
    """X-Dev-User-OID should be ignored in production mode."""
    mock_request.headers = {"X-Dev-User-OID": "test-oid-123"}

    with patch("middleware.auth.settings") as mock_settings:
        mock_settings.ENVIRONMENT = "production"
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_request)

    assert exc_info.value.status_code == 401

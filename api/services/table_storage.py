from azure.data.tables import TableServiceClient, TableClient
from config import settings

_service_client = None


def _get_service_client() -> TableServiceClient:
    global _service_client
    if _service_client is None:
        _service_client = TableServiceClient.from_connection_string(
            settings.STORAGE_CONNECTION_STRING
        )
    return _service_client


def get_table_client(table_name: str) -> TableClient:
    """Get a TableClient for the given table, creating the table if needed."""
    service = _get_service_client()
    try:
        service.create_table_if_not_exists(table_name)
    except Exception:
        pass  # Table may already exist
    return service.get_table_client(table_name)

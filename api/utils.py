import uuid

from fastapi import HTTPException


def validate_uuid(value: str) -> str:
    """Validate that a string is a valid UUID. Raises 400 if not."""
    try:
        uuid.UUID(value)
        return value
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

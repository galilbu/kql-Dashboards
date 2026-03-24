"""
Seed script for local development.
Creates a test dashboard and grants admin permissions to the dev user.

Usage:
    cd api
    python seed_dev_data.py
"""

import uuid
from datetime import datetime, timezone

DEV_USER_OID = "dev-user-00000000-0000-0000-0000-000000000001"


def seed():
    from dotenv import load_dotenv

    load_dotenv()

    from services.table_storage import get_table_client

    now = datetime.now(timezone.utc).isoformat()
    dashboard_id = str(uuid.uuid4())

    # Create a test dashboard
    dashboards_table = get_table_client("Dashboards")
    dashboards_table.upsert_entity(
        {
            "PartitionKey": "dashboard",
            "RowKey": dashboard_id,
            "title": "Security Overview",
            "description": "Test dashboard with sample KQL panels",
            "panels": "[]",
            "created_by": DEV_USER_OID,
            "created_at": now,
            "updated_at": now,
        }
    )
    print(f"Created dashboard: {dashboard_id}")

    # Grant admin to dev user
    permissions_table = get_table_client("DashboardPermissions")
    permissions_table.upsert_entity(
        {
            "PartitionKey": dashboard_id,
            "RowKey": DEV_USER_OID,
            "role": "admin",
            "granted_by": DEV_USER_OID,
            "granted_at": now,
        }
    )
    print(f"Granted admin to dev user: {DEV_USER_OID}")
    print("Done! Start the app and you should see the dashboard.")


if __name__ == "__main__":
    seed()

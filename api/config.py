from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    TENANT_ID: str = ""
    CLIENT_ID: str = ""
    CLIENT_SECRET: str = ""
    WORKSPACE_ID: str = ""
    STORAGE_CONNECTION_STRING: str = ""
    ENVIRONMENT: str = "development"
    FRONTEND_ORIGIN: str = "https://localhost:5173"
    SUPER_ADMIN_OIDS: str = ""  # comma-separated Entra user OIDs

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def super_admin_list(self) -> list[str]:
        if not self.SUPER_ADMIN_OIDS:
            return []
        return [oid.strip() for oid in self.SUPER_ADMIN_OIDS.split(",") if oid.strip()]


settings = Settings()

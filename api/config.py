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

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

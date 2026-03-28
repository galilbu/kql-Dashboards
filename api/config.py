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
    # ── Local auth ────────────────────────────────────────────
    LOCAL_JWT_SECRET: str = ""  # Secret for signing local JWTs (min 32 chars)
    LOCAL_SUPER_ADMIN_EMAILS: str = ""  # comma-separated emails with super-admin rights

    # ── Email (SMTP) — optional, for sending invite emails ───
    SMTP_HOST: str = ""  # e.g. smtp.office365.com
    SMTP_PORT: int = 587  # 587 for STARTTLS, 465 for SSL
    SMTP_USER: str = ""  # e.g. noreply@company.com
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""  # From address (defaults to SMTP_USER)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def super_admin_list(self) -> list[str]:
        if not self.SUPER_ADMIN_OIDS:
            return []
        return [oid.strip() for oid in self.SUPER_ADMIN_OIDS.split(",") if oid.strip()]

    @property
    def local_super_admin_list(self) -> list[str]:
        if not self.LOCAL_SUPER_ADMIN_EMAILS:
            return []
        return [
            e.strip().lower()
            for e in self.LOCAL_SUPER_ADMIN_EMAILS.split(",")
            if e.strip()
        ]


settings = Settings()

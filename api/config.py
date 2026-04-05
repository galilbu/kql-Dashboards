from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


def _kv(name: str, env_fallback: str = "") -> str:
    """Load a secret from Key Vault with env var fallback.
    Called at module load time for each sensitive setting."""
    from services.keyvault_service import get_secret

    return get_secret(name, env_fallback)


class Settings(BaseSettings):
    TENANT_ID: str = ""
    CLIENT_ID: str = ""
    CLIENT_SECRET: str = ""
    WORKSPACE_ID: str = ""
    STORAGE_CONNECTION_STRING: str = ""
    ENVIRONMENT: str = "development"
    FRONTEND_ORIGIN: str = "https://localhost:5173"
    SUPER_ADMIN_OIDS: str = ""  # comma-separated Entra user OIDs
    # ── Azure Key Vault (optional) ────────────────────────────
    AZURE_KEYVAULT_URL: str = ""  # e.g. https://my-soc-vault.vault.azure.net

    # ── Local auth ────────────────────────────────────────────
    LOCAL_JWT_SECRET: str = ""  # Secret for signing local JWTs (min 32 chars)
    LOCAL_SUPER_ADMIN_EMAILS: str = ""  # comma-separated emails with super-admin rights

    # ── Email (SMTP) — optional, for sending invite emails ───
    SMTP_HOST: str = ""  # e.g. smtp.office365.com
    SMTP_PORT: int = 587  # 587 for STARTTLS, 465 for SSL
    SMTP_USER: str = ""  # e.g. noreply@company.com
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""  # From address (defaults to SMTP_USER)

    # ── MDE (Microsoft Defender for Endpoint) — optional ────
    MDE_TENANT_ID: str = ""  # Falls back to TENANT_ID if empty
    MDE_CLIENT_ID: str = ""  # Falls back to CLIENT_ID if empty
    MDE_CLIENT_SECRET: str = ""  # Falls back to CLIENT_SECRET if empty

    # ── Azure OpenAI — for natural language → KQL generation ──
    AZURE_OPENAI_ENDPOINT: str = ""  # e.g. https://mycompany.openai.azure.com
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = ""  # e.g. gpt-4o

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)

    @property
    def openai_configured(self) -> bool:
        return bool(
            self.AZURE_OPENAI_ENDPOINT
            and self.AZURE_OPENAI_API_KEY
            and self.AZURE_OPENAI_DEPLOYMENT
        )

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


def _load_settings() -> Settings:
    """Load settings, then overlay secrets from Key Vault where available."""
    s = Settings()

    # Only attempt KV if URL is configured
    if s.AZURE_KEYVAULT_URL:
        # Map: Key Vault secret name → Settings attribute
        secret_fields = {
            "CLIENT-SECRET": "CLIENT_SECRET",
            "LOCAL-JWT-SECRET": "LOCAL_JWT_SECRET",
            "STORAGE-CONNECTION-STRING": "STORAGE_CONNECTION_STRING",
            "SMTP-PASSWORD": "SMTP_PASSWORD",
            "MDE-CLIENT-SECRET": "MDE_CLIENT_SECRET",
            "AZURE-OPENAI-API-KEY": "AZURE_OPENAI_API_KEY",
        }
        for kv_name, attr in secret_fields.items():
            val = _kv(kv_name, attr)
            if val:
                object.__setattr__(s, attr, val)

    return s


settings = _load_settings()

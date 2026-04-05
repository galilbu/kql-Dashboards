"""Azure Key Vault integration — loads secrets with env var fallback.

Usage:
    from services.keyvault_service import get_secret
    value = get_secret("CLIENT-SECRET")  # tries Key Vault, falls back to env

Key Vault secret names use hyphens (e.g. CLIENT-SECRET).
Env vars use underscores (e.g. CLIENT_SECRET).
"""

import os

import structlog

log = structlog.get_logger()

_kv_client = None
_kv_available: bool | None = None


def _get_kv_client():
    """Lazily initialize the Key Vault client. Returns None if not configured."""
    global _kv_client, _kv_available

    if _kv_available is False:
        return None
    if _kv_client is not None:
        return _kv_client

    vault_url = os.environ.get("AZURE_KEYVAULT_URL", "")
    if not vault_url:
        _kv_available = False
        log.info("keyvault_not_configured", hint="Set AZURE_KEYVAULT_URL to enable")
        return None

    try:
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.secrets import SecretClient

        _kv_client = SecretClient(
            vault_url=vault_url, credential=DefaultAzureCredential()
        )
        _kv_available = True
        log.info("keyvault_initialized", vault=vault_url)
        return _kv_client
    except Exception as exc:
        _kv_available = False
        log.warning("keyvault_init_failed", error=str(exc))
        return None


def get_secret(name: str, env_fallback: str = "") -> str:
    """Get a secret from Key Vault, falling back to env var.

    Args:
        name: Key Vault secret name (hyphens, e.g. "CLIENT-SECRET").
        env_fallback: Env var name to fall back to. If empty, auto-converts
                      the KV name from hyphens to underscores.

    Returns:
        The secret value, or empty string if not found anywhere.
    """
    # Try Key Vault first
    client = _get_kv_client()
    if client is not None:
        try:
            secret = client.get_secret(name)
            if secret.value:
                return secret.value
        except Exception:
            pass  # Fall through to env var

    # Fallback to env var
    env_name = env_fallback or name.replace("-", "_")
    return os.environ.get(env_name, "")

# Secure Development Guide

This document defines the security standards every contributor must follow when writing code for this project. It is not optional — these controls exist because this application executes queries against live security data (Sentinel + Defender) on behalf of authenticated users.

---

## Table of contents

1. [Secrets and credentials](#1-secrets-and-credentials)
2. [Authentication and token handling](#2-authentication-and-token-handling)
3. [Authorization — never trust the frontend](#3-authorization--never-trust-the-frontend)
4. [Input validation and KQL injection](#4-input-validation-and-kql-injection)
5. [API security](#5-api-security)
6. [Frontend security](#6-frontend-security)
7. [Dependency management](#7-dependency-management)
8. [Logging and monitoring](#8-logging-and-monitoring)
9. [Infrastructure and secrets rotation](#9-infrastructure-and-secrets-rotation)
10. [Security checklist for PRs](#10-security-checklist-for-prs)

---

## 1. Secrets and credentials

### Rules

- **Never hardcode secrets.** No client secrets, connection strings, workspace IDs, or API keys in source code — not even in comments or test files.
- **Never commit `.env`.** It is in `.gitignore`. If you accidentally commit a secret, treat it as compromised and rotate it immediately.
- **Use `.env.example`** to document which variables are needed, with no real values.
- Secrets in Azure are stored in **Function App Application Settings** — not in `host.json`, not in any file that gets deployed.
- For local development, load secrets from `.env` using `python-dotenv`. Never fall back to hardcoded defaults.

### What to do if a secret is leaked

1. Rotate the secret immediately in Azure Portal / Entra ID.
2. Force-push or use `git filter-repo` to scrub the secret from history.
3. Audit Azure sign-in logs for the affected credential for unexpected access.
4. Notify the team.

### Preferred: Managed Identity over client secrets

Client secrets expire and need rotation. Where possible — especially for the Function App calling Log Analytics — use a **System-assigned Managed Identity** instead of a client secret. The Bicep template has this as a commented option. Migrate to it once the app is stable.

```python
# Preferred (no secret needed)
from azure.identity import ManagedIdentityCredential
credential = ManagedIdentityCredential()

# Acceptable for local dev only
from azure.identity import ClientSecretCredential
credential = ClientSecretCredential(tenant_id, client_id, client_secret)

# Use DefaultAzureCredential to handle both automatically
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()
# → Uses Managed Identity in Azure, falls back to env vars / CLI locally
```

---

## 2. Authentication and token handling

### Backend

Every API request **must** pass through the auth middleware. There are no public endpoints except `/api/health`.

```python
# CORRECT — every protected route uses the dependency
@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(
    dashboard_id: str,
    user: AuthenticatedUser = Depends(get_current_user)  # ← required
):
    ...

# WRONG — missing auth dependency
@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str):
    ...
```

The `get_current_user` dependency must:

1. Extract the Bearer token from the `Authorization` header.
2. Fetch the Entra ID JWKS from `https://login.microsoftonline.com/{tenant_id}/v2.0/keys` — cache it, refresh every 24 hours.
3. Verify the JWT signature using the JWKS.
4. Validate `exp` (not expired), `aud` (must equal `CLIENT_ID`), `iss` (must equal your tenant's issuer URL), `tid` (must equal `TENANT_ID`).
5. Return the `oid` claim as the user identifier. Reject if any claim is missing or invalid.

```python
# CORRECT — all claims validated
assert claims["tid"] == settings.TENANT_ID, "Token from wrong tenant"
assert claims["aud"] == settings.CLIENT_ID, "Token for wrong audience"

# WRONG — trusting claims without verifying the signature
claims = jwt.decode(token, options={"verify_signature": False})  # NEVER do this
```

### Development bypass

The dev token bypass (`ENVIRONMENT=development` + `X-Dev-User-OID` header) must:

- Only activate when `ENVIRONMENT == "development"` — guarded by a hard check, not a fallback.
- Never be reachable in any deployed environment. The CI/CD pipeline sets `ENVIRONMENT=production`.
- Be clearly marked in code with a `# DEV ONLY` comment so it is visible in reviews.

```python
# DEV ONLY — remove this block if deploying manually outside CI/CD
if settings.ENVIRONMENT == "development":
    dev_oid = request.headers.get("X-Dev-User-OID")
    if dev_oid:
        return AuthenticatedUser(oid=dev_oid)
```

### Frontend

- Tokens are managed entirely by MSAL.js. Do not store tokens in `localStorage`, React state, or any custom storage.
- Never log tokens, even at `console.debug` level.
- Always use `acquireTokenSilent` before API calls; fall back to `acquireTokenPopup` on `InteractionRequiredAuthError`.
- Token expiry is handled by MSAL automatically — do not write custom expiry logic.

---

## 3. Authorization — never trust the frontend

The frontend hides UI elements (edit button, share panel) based on the user's role. This is UX only. **The backend must independently enforce every permission check** regardless of what the frontend sends.

```python
# CORRECT — backend enforces role, ignoring whatever the frontend claims
@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    body: DashboardUpdate,
    user: AuthenticatedUser = Depends(require_role("editor", dashboard_id))
):
    ...

# WRONG — trusting a role field sent by the client
@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(dashboard_id: str, body: DashboardUpdate):
    if body.claimed_role != "editor":   # ← attacker can send any value
        raise HTTPException(403)
```

### Role rank enforcement

```python
ROLE_RANK = {"viewer": 1, "editor": 2, "admin": 3}

async def require_role(min_role: str, dashboard_id: str):
    async def dependency(user: AuthenticatedUser = Depends(get_current_user)):
        row = await permissions_table.get(dashboard_id, user.oid)
        if not row or ROLE_RANK[row.role] < ROLE_RANK[min_role]:
            # Return 403, not 404 — do not reveal whether the dashboard exists
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dependency
```

> Returning `403` (not `404`) for inaccessible dashboards is intentional. A `404` would let an attacker enumerate which dashboard IDs exist.

---

## 4. Input validation and KQL injection

KQL queries from users are passed as strings to the Log Analytics API. The API does not support parameterized queries — the entire KQL string is submitted as-is. This means the primary defense is **tight validation and hard limits**, not parameterization.

### Required controls on every `/api/query` request

```python
class QueryRequest(BaseModel):
    kql: str
    dashboard_id: str

    @validator("kql")
    def validate_kql(cls, v):
        # 1. Length cap — prevent denial-of-service via huge queries
        if len(v) > 10_000:
            raise ValueError("Query exceeds maximum length")

        # 2. Block data exfiltration / modification operators
        # KQL is read-only by design, but belt-and-suspenders validation
        BLOCKED_PATTERNS = [
            r"\bexternaldata\b",   # reads from external URLs
            r"\bhttp_request\b",   # makes HTTP calls from within KQL
        ]
        for pattern in BLOCKED_PATTERNS:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError(f"Query contains a disallowed operator")

        return v
```

### Query execution limits

Always set timeouts and row caps on the Log Analytics client — never let a user's query run unbounded:

```python
from azure.monitor.query import LogsQueryClient
from datetime import timedelta

result = client.query_workspace(
    workspace_id=WORKSPACE_ID,
    query=kql,
    timespan=timedelta(days=30),         # max time range
    server_timeout=timedelta(seconds=60) # max execution time
)
```

### Path and ID validation

All `dashboard_id` parameters must be validated as UUIDs before hitting storage. Passing arbitrary strings as Table Storage partition/row keys is a potential injection vector.

```python
import uuid

def validate_uuid(value: str) -> str:
    try:
        uuid.UUID(value)
        return value
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
```

---

## 5. API security

### HTTP headers

Azure Static Web Apps sets several security headers automatically. Verify these are present in production responses and do not override them:

| Header | Expected value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |

Add these in `staticwebapp.config.json` for any that are missing:

```json
{
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
  }
}
```

### CORS

The Functions backend should only accept requests from the Static Web App origin. Configure this in `host.json` and as a Function App CORS setting in Azure — do not use a wildcard `*` origin in production.

```json
// host.json — local dev permissive, production locked via Azure portal setting
{
  "extensions": {
    "http": {
      "routePrefix": "api"
    }
  }
}
```

### Error responses

Never expose internal error details to the client. Log the full error server-side; return only a safe message:

```python
# CORRECT
try:
    result = await log_analytics.query(kql)
except Exception as e:
    logger.error("Query failed", exc_info=True, extra={"user_oid": user.oid})
    raise HTTPException(status_code=500, detail="Query execution failed")

# WRONG — leaks internal details
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))  # may expose workspace ID, stack trace, etc.
```

### Rate limiting

Add a simple per-user rate limit on `/api/query` to prevent a single user from hammering the Log Analytics API:

```python
# Using slowapi (a FastAPI-compatible rate limiter)
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=lambda req: req.state.user.oid)  # rate limit per user, not per IP

@router.post("/query")
@limiter.limit("30/minute")
async def run_query(...):
    ...
```

---

## 6. Frontend security

### Content Security Policy

Add a CSP header in `staticwebapp.config.json`. Start strict and loosen only if needed:

```json
{
  "globalHeaders": {
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com https://api.loganalytics.io; frame-ancestors 'none';"
  }
}
```

> `'unsafe-inline'` for styles is needed by Monaco Editor. Do not add it for scripts.

### No `dangerouslySetInnerHTML`

Query results returned from Log Analytics may contain user-controlled strings (e.g. alert names, process paths, URLs). Never render these with `dangerouslySetInnerHTML` or `innerHTML`. Always render result data as text content, not HTML.

```tsx
// CORRECT
<td>{cell.toString()}</td>

// WRONG — XSS if cell contains <script>...</script>
<td dangerouslySetInnerHTML={{ __html: cell }} />
```

### URL handling

If query results contain URLs (e.g. file paths, external links), validate them before rendering as `<a>` tags. Block `javascript:` and `data:` schemes:

```tsx
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

---

## 7. Dependency management

### Python

- Pin all dependencies to exact versions in `requirements.txt` (`package==1.2.3`, not `package>=1.2`).
- Use `requirements-dev.txt` for dev-only tools (pytest, black, ruff) — keep them out of the production bundle.
- Run `pip audit` in CI to catch known CVEs:

```yaml
# In GitHub Actions
- name: Audit Python dependencies
  run: pip install pip-audit && pip-audit -r api/requirements.txt
```

### Node.js

- Use `npm ci` (not `npm install`) in CI — it installs exactly what is in `package-lock.json`.
- Run `npm audit` in CI:

```yaml
- name: Audit Node dependencies
  run: cd frontend && npm audit --audit-level=high
```

- Dependabot is configured in `.github/dependabot.yml` to open weekly PRs for both ecosystems.

---

## 8. Logging and monitoring

### What to log

| Event | Level | Fields to include |
|---|---|---|
| Successful login | INFO | user oid, timestamp |
| 401 / 403 response | WARNING | user oid (if available), route, dashboard_id |
| KQL query executed | INFO | user oid, dashboard_id, query length, execution time ms |
| Permission granted / revoked | INFO | granter oid, target oid, role, dashboard_id |
| Query error from Log Analytics | ERROR | user oid, dashboard_id, error code (not full error) |
| Unhandled exception | ERROR | full stack trace (server-side only) |

### What never to log

- JWT tokens or any part of them
- Client secrets or connection strings
- Full KQL query text (may contain sensitive filter values)
- Raw Log Analytics results (may contain sensitive security data)

### Structured logging

Use structured (JSON) logging so logs are queryable in Azure Monitor:

```python
import structlog

logger = structlog.get_logger()

logger.info(
    "kql_query_executed",
    user_oid=user.oid,
    dashboard_id=dashboard_id,
    query_length=len(kql),
    duration_ms=duration,
)
```

---

## 9. Infrastructure and secrets rotation

### Client secret rotation

Client secrets should be rotated every **90 days**. Steps:

1. Create a new secret in Entra ID → App Registration → Certificates & secrets.
2. Update `CLIENT_SECRET` in Azure Function App settings.
3. Verify the app works with the new secret.
4. Delete the old secret from Entra ID.

Set a calendar reminder. The app will return `401` for all users when the secret expires.

Long-term: migrate to Managed Identity to eliminate this entirely.

### Storage Account access keys

Do not use Storage Account access keys in production — use a connection string scoped to Table Storage, or better, use the Managed Identity of the Function App with the `Storage Table Data Contributor` role.

### Bicep — no hardcoded values

Infrastructure templates must not contain hardcoded secrets, subscription IDs, or tenant IDs. All sensitive values come from `parameters.json` (which is gitignored) or from CI/CD pipeline variables.

```bicep
// CORRECT
param clientSecret string  // passed in at deploy time

// WRONG
var clientSecret = 'abc123...'
```

---

## 10. Security checklist for PRs

Every pull request that touches backend routes, auth logic, or infrastructure must be reviewed against this list:

### Authentication & authorization
- [ ] All new routes have `Depends(get_current_user)` or `Depends(require_role(...))`
- [ ] No route returns data before the auth dependency resolves
- [ ] Role check uses `ROLE_RANK` comparison, not string equality
- [ ] 403 is returned for unauthorized access (not 404, not 200 with empty data)

### Input handling
- [ ] All path parameters (IDs) validated as UUIDs
- [ ] Request bodies use Pydantic models with field validators
- [ ] KQL input is length-capped and checked against blocked operator list
- [ ] No user input is interpolated into KQL strings server-side

### Secrets
- [ ] No secrets, tokens, or credentials in the diff
- [ ] Any new config variable is in `.env.example` with no real value
- [ ] `DefaultAzureCredential` used for Azure SDK calls (not hardcoded credentials)

### Error handling
- [ ] `except Exception` blocks log the full error server-side
- [ ] HTTP error responses contain only a safe, generic message
- [ ] No stack traces, workspace IDs, or internal paths in API responses

### Frontend
- [ ] No `dangerouslySetInnerHTML` with user-controlled data
- [ ] URLs from query results validated before rendering as links
- [ ] No tokens or secrets in `console.log` calls

### Dependencies
- [ ] New `pip` packages pinned to exact version
- [ ] `npm audit` and `pip-audit` pass with no high/critical findings

# Authentication & Authorization

## Overview

Authentication is handled entirely by Microsoft Entra ID. The app uses the OAuth 2.0 authorization code flow with PKCE on the frontend, and validates tokens server-side on every API request. Authorization is enforced per-dashboard using a role-based model stored in Azure Table Storage.

## Authentication flow

```
1. User visits the app (unauthenticated)
2. MSAL.js redirects to Entra ID login page
3. User authenticates (password, MFA, SSO — whatever your tenant requires)
4. Entra ID issues an ID token + access token
5. MSAL stores tokens in session storage
6. All API requests include: Authorization: Bearer <access_token>
7. FastAPI middleware validates the token on every request
```

The frontend never handles passwords or credentials. All auth logic is delegated to Entra ID and MSAL.

## Token claims used

| Claim | Description | Used for |
|---|---|---|
| `oid` | Object ID — stable, tenant-scoped user identifier | Permission lookups (primary key) |
| `tid` | Tenant ID | Validate token is from your tenant |
| `preferred_username` | UPN / email | Display in UI |
| `name` | Display name | Display in UI |

> **Important:** Always use `oid` (not email) as the user identifier in the permissions table. Emails can change; `oid` never changes for a given user in your tenant.

## Token scopes

| Scope | Requested by | Purpose |
|---|---|---|
| `openid profile email` | Frontend | Standard OIDC — ID token claims |
| `https://api.loganalytics.io/.default` | Frontend | Execute KQL queries |
| `https://graph.microsoft.com/User.Read` | Frontend | Read own profile |
| `https://graph.microsoft.com/User.ReadBasic.All` | Frontend | Search users when granting permissions |

Tokens are acquired lazily — the Log Analytics scope is only requested when a user runs a query for the first time.

## Backend token validation

Every FastAPI request goes through the auth middleware before reaching any route handler:

```python
# Pseudocode — see api/middleware/auth.py for full implementation
async def validate_token(authorization: str):
    token = authorization.removeprefix("Bearer ")
    
    # Fetch Entra ID JWKS (cached, refreshed every 24h)
    jwks = await get_jwks(tenant_id)
    
    # Validate signature, expiry, audience, issuer
    claims = jwt.decode(
        token,
        jwks,
        audience=CLIENT_ID,
        issuer=f"https://login.microsoftonline.com/{TENANT_ID}/v2.0"
    )
    
    # Reject tokens from other tenants
    assert claims["tid"] == TENANT_ID
    
    return claims["oid"], claims
```

The middleware rejects any request with a missing, expired, or invalid token with `401 Unauthorized`.

## RBAC model

Authorization is per-dashboard. A user has no access to a dashboard unless there is an explicit row in the `DashboardPermissions` table for that user + dashboard combination.

### Roles

| Role | Who it's for | What they can do |
|---|---|---|
| `viewer` | Read-only stakeholders | View panels, run saved queries, export results |
| `editor` | Analysts building dashboards | Everything viewer can do + edit panels, write and save KQL queries, change chart settings |
| `admin` | Dashboard owner | Everything editor can do + grant/revoke roles, rename/delete the dashboard |

Roles are hierarchical: `admin > editor > viewer`. A user with `editor` can do everything a `viewer` can.

### Enforcement

Role checks happen in a FastAPI dependency, applied per route:

```python
# Usage in a route
@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    user: User = Depends(require_role("editor", dashboard_id))
):
    ...
```

If the user has no row in the permissions table, or their role rank is below the required minimum, the API returns `403 Forbidden`. The response body does not reveal whether the dashboard exists — this prevents enumeration attacks.

### Dashboard creation

When a user creates a dashboard, the API automatically inserts an `admin` row for that user in `DashboardPermissions`. There is always at least one admin per dashboard.

### Listing dashboards

`GET /api/dashboards` returns only dashboards where the calling user has a permissions row. This is enforced with a Table Storage query — the backend never fetches all dashboards and filters in memory.

## App Registration setup

One App Registration is used for both user login and backend API calls.

### Redirect URIs to configure

| Environment | URI |
|---|---|
| Local dev | `http://localhost:5173` |
| Production | `https://<your-swa-name>.azurestaticapps.net` |

### Required API permissions

| API | Permission | Type | Reason |
|---|---|---|---|
| Microsoft Graph | `User.Read` | Delegated | Sign-in and read profile |
| Microsoft Graph | `User.ReadBasic.All` | Delegated | Search users in the tenant when granting dashboard access |

### Implicit flow

Disable implicit grant (ID tokens and access tokens via implicit flow) — the app uses auth code flow with PKCE, which is more secure.

## Local development

For local dev, the backend skips strict token validation if `ENVIRONMENT=development` is set in `.env` and the request includes a mock `X-Dev-User-OID` header. This header is injected automatically by the dev proxy in `vite.config.ts`.

> **Never deploy with `ENVIRONMENT=development`.** The CI/CD pipeline sets `ENVIRONMENT=production` in all Azure environments.

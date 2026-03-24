# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report security issues by emailing: **security@your-org.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive a response within 48 hours. We aim to release a fix within 14 days of a confirmed vulnerability.

---

## Security model

### What this application can access

The App Registration is granted read-only access to Log Analytics and Sentinel. It cannot:

- Modify or delete data in Log Analytics
- Create or modify Sentinel incidents or alerts
- Access other Azure resources in the subscription

The principle of least privilege is enforced via Bicep — no broader roles are assigned.

### What users can access

Users can only access dashboards they have been explicitly granted permission to. The backend enforces this on every request — there is no way to enumerate or access another user's dashboards via the API.

KQL queries are executed with the **application's** Log Analytics credentials, not the user's credentials. This means:

- All users with viewer+ access on a dashboard can query any table in the workspace.
- There is no table-level or row-level access control within a dashboard.
- If you need to restrict which tables certain users can query, this must be enforced by creating separate Log Analytics workspaces with separate App Registrations.

### Token security

- Access tokens are stored in session storage by MSAL.js — they are cleared when the browser tab closes.
- Tokens are never logged, stored in Table Storage, or sent to any third-party service.
- Token validation on the backend uses the Entra ID JWKS endpoint — signatures are always verified.
- The backend rejects tokens from other tenants (`tid` claim is validated).

---

## Security controls

| Control | Implementation |
|---|---|
| Authentication | Entra ID — no passwords stored by this app |
| Authorization | Per-dashboard RBAC, enforced server-side on every request |
| Transport | HTTPS enforced by Azure Static Web Apps (HSTS) |
| Token validation | JWT signature + expiry + audience + issuer + tenant validated |
| Secrets | Stored in Azure Function App settings — never in code or `.env` files committed to git |
| KQL injection | Queries are passed as strings — no server-side string interpolation of user input into KQL |
| Dependency scanning | Dependabot enabled for both `npm` and `pip` dependencies |

---

## Known limitations

- **No KQL query sandboxing.** Users with viewer+ access can run any valid KQL query against the workspace, including expensive queries that could impact performance. Consider adding query timeout limits and row count caps in `api/services/log_analytics.py`.
- **No audit log.** There is currently no log of which users ran which queries. If your compliance requirements need this, add logging to the `/api/query` route.
- **Client secret rotation.** The App Registration uses a client secret. Secrets should be rotated every 90 days. Consider migrating to Managed Identity (no secret required) once the app is stable — the Bicep template has a commented-out Managed Identity configuration.

---

## Dependency updates

Dependabot is configured to check for updates weekly on both `frontend/package.json` and `api/requirements.txt`. Security updates are auto-merged if CI passes. All other updates require review.

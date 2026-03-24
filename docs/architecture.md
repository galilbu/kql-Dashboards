# Architecture

## System overview

```
┌─────────────────────────────────────────────────────────┐
│                    User's browser                        │
│           React SPA (MSAL.js + Monaco + Recharts)        │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS (Bearer token)
┌───────────────────▼─────────────────────────────────────┐
│              Azure Static Web Apps                       │
│         React bundle served via global CDN               │
│              /api/* → Azure Functions                    │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│              Azure Functions (Custom Handler)            │
│                  FastAPI (Python 3.11)                   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ /api/query   │  │ /api/dash..  │  │ /api/..perms  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│  ┌──────▼─────────────────▼───────────────────▼───────┐  │
│  │           RBAC middleware (oid from JWT)            │  │
│  └──────┬──────────────────────────┬──────────────────┘  │
└─────────┼──────────────────────────┼────────────────────┘
          │                          │
┌─────────▼──────────┐  ┌────────────▼──────────────────┐
│  Azure Monitor /   │  │     Azure Table Storage        │
│  Log Analytics     │  │  Dashboards + Permissions      │
│  (KQL execution)   │  └───────────────────────────────┘
└────────────────────┘
          ▲
┌─────────┴──────────────────────────────────────────────┐
│                Microsoft Sentinel tables                │
│          SecurityAlert, SecurityIncident, ...           │
│                Microsoft Defender tables                │
│          DeviceEvents, DeviceAlerts, ...                │
└────────────────────────────────────────────────────────┘
```

## Components

### Frontend (Azure Static Web Apps)

A single-page React application built with Vite. Key responsibilities:

- **MSAL.js auth** — handles Entra ID login, token acquisition, and silent refresh. Tokens are stored in session storage, never in the app's own state.
- **Monaco editor** — provides KQL syntax highlighting and basic autocompletion for the query editor panel.
- **Recharts** — renders query results as line, bar, or pie charts. Chart type is inferred from column types (time column → line, categorical column → bar/pie).
- **Dashboard grid** — a resizable/draggable panel layout where each panel has its own saved KQL query and chart configuration.

The `staticwebapp.config.json` file proxies all `/api/*` requests to the Azure Functions backend and handles client-side routing fallback to `index.html`.

### Backend (Azure Functions + FastAPI)

FastAPI runs as a Custom Handler inside Azure Functions. This means the Functions host manages scaling and HTTP routing, while FastAPI handles request parsing, middleware, and route logic.

Key responsibilities:

- **Token validation** — every request validates the Bearer token against Entra ID using the `oid` and `tid` claims.
- **RBAC middleware** — checks `DashboardPermissions` table before any route handler executes.
- **KQL proxy** — accepts a KQL query string and workspace ID, executes it via `azure-monitor-query`, and returns tabular results as JSON.
- **User resolution** — calls MS Graph API to search users by name/UPN when a dashboard admin adds a new member.

### Azure Table Storage

Two tables:

**Dashboards**
| Field | Type | Notes |
|---|---|---|
| PartitionKey | string | Fixed value `"dashboard"` |
| RowKey | string | UUID, the dashboard ID |
| title | string | |
| description | string | |
| panels | string | JSON-serialized panel config |
| created_by | string | user oid |
| created_at | datetime | |
| updated_at | datetime | |

**DashboardPermissions**
| Field | Type | Notes |
|---|---|---|
| PartitionKey | string | dashboard_id |
| RowKey | string | user oid (from Entra ID JWT) |
| role | string | `viewer`, `editor`, or `admin` |
| granted_by | string | user oid of granter |
| granted_at | datetime | |

### Microsoft Entra ID

A single App Registration handles both:

1. **User authentication** — users sign in via MSAL.js using the auth code flow with PKCE.
2. **Backend credentials** — the Functions app uses a client secret (or Managed Identity in production) to call Log Analytics and MS Graph on behalf of the application.

Required API permissions:

| Permission | Type | Purpose |
|---|---|---|
| `User.Read` | Delegated | Read signed-in user profile |
| `User.ReadBasic.All` | Delegated | Search users when granting permissions |

Required Azure RBAC roles (assigned in Bicep):

| Role | Scope | Purpose |
|---|---|---|
| `Log Analytics Reader` | Log Analytics workspace | Execute KQL queries |
| `Microsoft Sentinel Reader` | Resource group | Read Sentinel tables |

## Request lifecycle

### KQL query execution

```
1. User writes KQL in Monaco editor and clicks Run
2. Frontend acquires token with scope https://api.loganalytics.io/.default
3. POST /api/query { kql, dashboard_id }
4. Middleware: validate JWT, extract oid
5. Middleware: check DashboardPermissions → oid must have viewer+ on dashboard_id
6. Route handler: forward KQL to Log Analytics REST API using azure-monitor-query
7. Response: { columns: [...], rows: [...] }
8. Frontend: infer chart type from columns, render with Recharts
```

### Permission grant

```
1. Admin opens share panel, searches "Alice"
2. Frontend calls GET /api/users/search?q=Alice
3. Backend calls MS Graph GET /users?$search="displayName:Alice"
4. Admin selects Alice, chooses role "editor", clicks Save
5. POST /api/dashboards/{id}/permissions { user_oid, role }
6. Middleware: caller must be admin on this dashboard
7. Backend upserts row in DashboardPermissions table
```

## Scalability notes

- Azure Static Web Apps includes a global CDN — no additional CDN configuration needed.
- Azure Functions scale to zero when idle; cold start for Python Custom Handler is ~2–4s. Acceptable for a security tooling context.
- Table Storage handles thousands of dashboards and permission rows with no configuration.
- KQL query latency is dominated by Log Analytics execution time, not the API layer.

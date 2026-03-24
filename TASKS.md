# KQL Dashboard — Task Tracker

## Phase 1: Project Scaffolding & Configuration ✅

- [x] Initialize git repository and `.gitignore`
- [x] Create frontend project (Vite + React + TypeScript)
- [x] Create backend project structure (`api/` with FastAPI)
- [x] Configure `staticwebapp.config.json` (routing, security headers, fallback)
- [x] Configure `vite.config.ts` (dev proxy to backend)
- [x] Create `host.json` and Azure Functions entry point
- [x] Add `requirements.txt` and `requirements-dev.txt`
- [x] Add pre-commit config (`.pre-commit-config.yaml`)
- [x] Add ESLint + Prettier configs for frontend

## Phase 2: Authentication (Backend) ✅

- [x] Implement Entra ID JWKS fetching and caching (`api/middleware/auth.py`)
- [x] Implement JWT validation middleware (`get_current_user` dependency)
- [x] Implement dev-mode token bypass (`ENVIRONMENT=development` + `X-Dev-User-OID`)
- [x] Implement settings/config loading from env vars (`api/config.py`)
- [x] Add `/api/health` public endpoint
- [x] Write tests for auth middleware

## Phase 3: Authentication (Frontend) ✅

- [x] Configure MSAL.js (`frontend/src/auth/msalConfig.ts`)
- [x] Create MSAL provider and auth hooks (`useAuth`, `useToken`)
- [x] Create `AuthGuard` component (redirect to login if unauthenticated)
- [x] Implement silent token acquisition + popup fallback
- [x] Create login/logout UI flow

## Phase 4: Storage Layer ✅

- [x] Implement Azure Table Storage client wrapper (`api/services/table_storage.py`)
- [x] Implement `Dashboards` table CRUD operations (`api/services/dashboard_service.py`)
- [x] Implement `DashboardPermissions` table operations (`api/services/permissions_service.py`)
- [x] Add UUID validation utility
- [x] Write tests for storage services

## Phase 5: RBAC & Permissions ✅

- [x] Implement `require_role` dependency with role rank enforcement (`api/middleware/rbac.py`)
- [x] Implement permission grant/revoke logic (admin-only)
- [x] Implement MS Graph user search service (`api/services/graph_service.py`)
- [x] API route: `GET /api/dashboards/{id}/permissions`
- [x] API route: `POST /api/dashboards/{id}/permissions` (grant)
- [x] API route: `DELETE /api/dashboards/{id}/permissions/{user_oid}` (revoke)
- [x] API route: `GET /api/users/search?q=` (Graph user search)
- [x] Write tests for RBAC middleware and permission routes

## Phase 6: Dashboard API Routes ✅

- [x] API route: `GET /api/dashboards` (list user's dashboards)
- [x] API route: `POST /api/dashboards` (create, auto-grant admin)
- [x] API route: `GET /api/dashboards/{id}` (get single dashboard)
- [x] API route: `PUT /api/dashboards/{id}` (update, requires editor+)
- [x] API route: `DELETE /api/dashboards/{id}` (delete, requires admin)
- [x] Pydantic models for request/response bodies
- [x] Write tests for dashboard routes

## Phase 7: KQL Query Execution ✅

- [x] Implement Log Analytics client wrapper (`api/services/log_analytics.py`)
- [x] Implement KQL input validation (length cap, blocked operators)
- [x] Implement query timeout and row limits
- [x] API route: `POST /api/query` (execute KQL, requires viewer+)
- [x] Add rate limiting with slowapi (`30/minute` per user)
- [x] Write tests for query route and validation

## Phase 8: Frontend — Dashboard UI ✅

- [x] Set up React Router with route structure
- [x] Create app layout (navbar, sidebar, content area)
- [x] Build dashboard list page (`/dashboards`)
- [x] Build create dashboard form
- [x] Build dashboard view page with panel grid (resizable/draggable)
- [x] Implement panel CRUD (add, edit, remove panels)
- [x] Implement dashboard save/update

## Phase 9: Frontend — KQL Editor & Charts ✅

- [x] Integrate Monaco Editor with KQL syntax highlighting
- [x] Build query execution flow (run button → API call → results)
- [x] Build results table component
- [x] Implement chart type inference from column types
- [x] Integrate Recharts (line, bar, pie chart components)
- [x] Build chart configuration panel (type override, axis selection)
- [x] Implement CSV export for query results

## Phase 10: Frontend — Sharing & Permissions UI ✅

- [x] Build share/permissions dialog
- [x] Implement user search (typeahead against `/api/users/search`)
- [x] Build role selector (viewer/editor/admin)
- [x] Build current members list with role display and revoke button
- [x] Conditionally show edit/share UI based on user's role

## Phase 11: Infrastructure as Code ✅

- [x] Create `infra/main.bicep` (Static Web App, Function App, Storage Account)
- [x] Create `infra/parameters.json` (parameterized, no secrets)
- [x] Configure Managed Identity (system-assigned on Function App)
- [x] Assign RBAC roles (Log Analytics Reader, Sentinel Reader)

## Phase 12: CI/CD & Final Polish ✅

- [x] Create `.github/workflows/deploy.yml` (build + deploy pipeline)
- [x] Add `pip-audit` and `npm audit` steps to CI
- [x] Configure Dependabot (`.github/dependabot.yml`)
- [x] Add structured logging with `structlog`
- [x] Error handling review (no internal details leaked)
- [x] Final security checklist pass (per `secure_dev.md`)
- [x] Verify CSP, CORS, and security headers

---

*Last updated: 2026-03-24*

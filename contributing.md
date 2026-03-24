# Contributing

## Development setup

### Clone and install

```bash
git clone https://github.com/your-org/kql-dashboard.git
cd kql-dashboard

# Frontend
cd frontend && npm install

# Backend
cd ../api && pip install -r requirements.txt -r requirements-dev.txt
```

### Environment

```bash
cp .env.example .env
# Fill in TENANT_ID, CLIENT_ID, CLIENT_SECRET, WORKSPACE_ID
# Set ENVIRONMENT=development for local dev token bypass
```

### Running locally

```bash
# Terminal 1 — backend
cd api && func start

# Terminal 2 — frontend
cd frontend && npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:7071/api` automatically.

---

## Branching

| Branch | Purpose |
|---|---|
| `main` | Production. Protected — no direct pushes. |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Dependencies, tooling, docs |

All changes go through a pull request against `main`. PRs get an automatic Azure Static Web Apps preview environment.

---

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add export to CSV for query results
fix: handle empty result set in chart renderer
chore: bump azure-monitor-query to 1.3.0
docs: add RBAC model diagram to AUTH.md
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`

---

## Code style

### Frontend (TypeScript / React)

- Formatter: Prettier (config in `frontend/.prettierrc`)
- Linter: ESLint (config in `frontend/eslint.config.ts`)
- Run before committing: `npm run lint && npm run format`

### Backend (Python)

- Formatter: Black (`black api/`)
- Linter: Ruff (`ruff check api/`)
- Type hints required on all function signatures
- Run before committing: `black api/ && ruff check api/`

A pre-commit config is included — install hooks with:

```bash
pip install pre-commit
pre-commit install
```

---

## Testing

### Backend

```bash
cd api && pytest
```

Tests live in `api/tests/`. Each route has a corresponding test file. Use `pytest-asyncio` for async route tests. Mock the Log Analytics client and Table Storage client — do not make real Azure calls in tests.

### Frontend

```bash
cd frontend && npm test
```

Uses Vitest + React Testing Library. Focus tests on: MSAL auth hooks, chart type inference logic, and the permissions UI.

---

## Pull request checklist

Before opening a PR:

- [ ] `npm run lint` passes (frontend)
- [ ] `black` and `ruff` pass (backend)
- [ ] New routes have tests in `api/tests/`
- [ ] Any new environment variable is added to `.env.example`
- [ ] `ARCHITECTURE.md` or `AUTH.md` updated if the design changed
- [ ] PR description explains *what* and *why*, not just *what*

---

## Adding a new API route

1. Create the route in `api/routes/<resource>.py`
2. Apply the `require_role` dependency with the appropriate minimum role
3. Register it in `api/function_app.py`
4. Add a test in `api/tests/test_<resource>.py`
5. Document any new endpoint in `ARCHITECTURE.md`

## Adding a new frontend page

1. Create the page component in `frontend/src/pages/`
2. Add the route to the router in `frontend/src/App.tsx`
3. Wrap it in the `AuthGuard` component to require login
4. Add the path to `staticwebapp.config.json` navigation fallback rules if needed

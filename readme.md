# KQL Dashboard

A web application for building interactive dashboards from KQL queries on Microsoft Sentinel and Defender data.

## Overview

KQL Dashboard lets security teams write ad-hoc KQL queries against their Log Analytics workspace and visualize results as charts and tables — with per-dashboard access control backed by Entra ID.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, MSAL.js, Recharts, Monaco Editor |
| Backend | Python 3.11, FastAPI, Azure Functions (Custom Handler) |
| Auth | Microsoft Entra ID (Azure AD), MSAL |
| Storage | Azure Table Storage |
| Data | Azure Monitor / Log Analytics (KQL) |
| Hosting | Azure Static Web Apps + Azure Functions |
| IaC | Bicep |
| CI/CD | GitHub Actions |

## Quick start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Azure CLI
- An Azure subscription with a Log Analytics workspace containing Sentinel / Defender data

### Local development

```bash
# 1. Clone the repo
git clone https://github.com/your-org/kql-dashboard.git
cd kql-dashboard

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your workspace ID, tenant ID, client ID, client secret

# 3. Install frontend dependencies
cd frontend && npm install

# 4. Install backend dependencies
cd ../api && pip install -r requirements.txt

# 5. Start the backend (Functions local runtime)
cd api && func start

# 6. Start the frontend (in a separate terminal)
cd frontend && npm run dev
```

Frontend runs at `http://localhost:5173`, API at `http://localhost:7071/api`.

## Project structure

```
kql-dashboard/
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── auth/              # MSAL config and hooks
│   │   ├── components/        # UI components
│   │   ├── api/               # API client
│   │   └── pages/             # Route pages
│   ├── staticwebapp.config.json
│   └── vite.config.ts
├── api/                       # Azure Functions + FastAPI
│   ├── function_app.py        # Functions entry point
│   ├── routes/                # API route handlers
│   ├── services/              # Log Analytics, Graph, permissions
│   ├── middleware/            # Auth and RBAC middleware
│   ├── host.json
│   └── requirements.txt
├── infra/                     # Bicep infrastructure
│   ├── main.bicep
│   └── parameters.json
├── .github/workflows/         # CI/CD
├── docs/                      # Additional documentation
└── .env.example
```

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design and component overview |
| [AUTH.md](./docs/AUTH.md) | Authentication and RBAC model |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Azure setup and deployment guide |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development workflow and conventions |
| [SECURITY.md](./SECURITY.md) | Security policy and reporting |

## License

MIT

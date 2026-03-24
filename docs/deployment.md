# Deployment Guide

## Prerequisites

- Azure CLI installed and logged in (`az login`)
- An Azure subscription
- A Log Analytics workspace with Sentinel / Defender data
- A GitHub account and repository for this project
- Node.js 18+ and Python 3.11+ for local builds

---

## One-time Azure setup

### 1. Create a resource group

```bash
az group create \
  --name rg-kql-dashboard \
  --location westeurope
```

Choose a region close to your Log Analytics workspace to minimize query latency.

### 2. Deploy infrastructure via Bicep

```bash
az deployment group create \
  --resource-group rg-kql-dashboard \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.json
```

This provisions:
- Azure Static Web App (Standard tier)
- Azure Function App (Python 3.11, Custom Handler)
- Azure Storage Account (Table Storage for dashboards and permissions)
- App Registration with correct RBAC roles pre-assigned

Save the output values — you'll need them for GitHub secrets.

### 3. Configure the App Registration

In Azure Portal → Entra ID → App registrations → your app:

**Redirect URIs** (Authentication tab):
- Add `https://<your-swa-name>.azurestaticapps.net`
- Add `http://localhost:5173` for local development

**API permissions** (API permissions tab):
- `Microsoft Graph → User.Read` (Delegated)
- `Microsoft Graph → User.ReadBasic.All` (Delegated)
- Click "Grant admin consent for [your tenant]"

**Client secret** (Certificates & secrets tab):
- Create a new client secret
- Copy the value immediately — it won't be shown again

### 4. Get the Static Web App deployment token

```bash
az staticwebapp secrets list \
  --name <your-swa-name> \
  --resource-group rg-kql-dashboard \
  --query "properties.apiKey" -o tsv
```

---

## GitHub repository setup

### Add secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret name | Where to find it |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Step 4 above |
| `TENANT_ID` | Entra ID → Overview → Tenant ID |
| `CLIENT_ID` | App Registration → Overview → Application (client) ID |
| `CLIENT_SECRET` | App Registration → Certificates & secrets |
| `WORKSPACE_ID` | Log Analytics → Overview → Workspace ID |
| `STORAGE_CONNECTION_STRING` | Storage Account → Access keys → Connection string |

---

## CI/CD pipeline

The `.github/workflows/deploy.yml` workflow runs on every push to `main`:

```
push to main
    │
    ├── build-frontend job
    │     npm install → npm run build
    │     Output: frontend/dist/
    │
    ├── build-api job
    │     pip install → run tests
    │     Output: api/
    │
    └── deploy job (needs both above)
          Azure Static Web Apps Action
          Deploys frontend dist/ + api/ together
          SWA routes /api/* to Functions automatically
```

### Manual deployment (without CI/CD)

If you want to deploy manually without GitHub Actions:

```bash
# Build frontend
cd frontend && npm run build

# Deploy via SWA CLI
npm install -g @azure/static-web-apps-cli
swa deploy ./frontend/dist \
  --api-location ./api \
  --deployment-token <your-token>
```

---

## Environment variables

### Backend (Azure Function App settings)

Set these in Azure Portal → Function App → Configuration → Application settings, or via CLI:

```bash
az functionapp config appsettings set \
  --name <function-app-name> \
  --resource-group rg-kql-dashboard \
  --settings \
    TENANT_ID=<value> \
    CLIENT_ID=<value> \
    CLIENT_SECRET=<value> \
    WORKSPACE_ID=<value> \
    STORAGE_CONNECTION_STRING=<value> \
    ENVIRONMENT=production
```

### Frontend (build-time)

Frontend environment variables are injected at build time by the GitHub Actions workflow. They are baked into the static bundle — do not put secrets here. Safe to include:

```
VITE_TENANT_ID=...
VITE_CLIENT_ID=...
VITE_API_BASE_URL=/api
```

---

## Post-deployment verification

After a successful deploy, verify the following:

```bash
# 1. Check Static Web App is up
curl https://<your-swa-name>.azurestaticapps.net

# 2. Check Functions health endpoint
curl https://<your-swa-name>.azurestaticapps.net/api/health

# 3. Confirm Log Analytics connectivity (authenticated)
# Open the app, log in, and run a test query:
# SecurityAlert | take 1
```

---

## Environments

| Environment | Trigger | URL |
|---|---|---|
| Production | Push to `main` | `https://<swa-name>.azurestaticapps.net` |
| Preview | Pull request | Auto-generated per PR by SWA |
| Local | Manual | `http://localhost:5173` |

Pull request preview environments are created and destroyed automatically by Azure Static Web Apps — no extra configuration needed.

---

## Tearing down

```bash
# Remove all Azure resources
az group delete --name rg-kql-dashboard --yes --no-wait
```

This deletes everything provisioned by the Bicep template. The GitHub secrets and App Registration must be removed separately.

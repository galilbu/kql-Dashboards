targetScope = 'resourceGroup'

@description('Base name prefix for new resources (matches existing secopskqldash* naming)')
param baseName string = 'secopskqldash'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Entra ID tenant ID')
param tenantId string

@description('Entra ID app client ID')
param clientId string

@secure()
@description('Entra ID app client secret')
param clientSecret string

@description('Log Analytics workspace ID (GUID) for KQL queries')
param workspaceId string

@description('Log Analytics workspace resource ID (full ARM ID, for RBAC assignment)')
param workspaceResourceId string

@secure()
@description('Secret for signing local JWTs. Generate: python -c "import secrets; print(secrets.token_hex(32))"')
param localJwtSecret string = ''

@description('Comma-separated emails with local super-admin rights')
param localSuperAdminEmails string = ''

// ── Reference EXISTING Storage Account ──────────────────────
// Already deployed as secopskqldashstor — do not recreate
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: '${baseName}stor'
}

// ── Reference EXISTING Static Web App ───────────────────────
// Already deployed as secops-kqldash-swa — do not recreate
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' existing = {
  name: 'secops-kqldash-swa'
}

// ── App Service Plan (Consumption / Linux) ───────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${baseName}-plan'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // required for Linux
  }
}

// ── Function App ─────────────────────────────────────────────
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${baseName}-func'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'custom' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'TENANT_ID', value: tenantId }
        { name: 'CLIENT_ID', value: clientId }
        { name: 'CLIENT_SECRET', value: clientSecret }
        { name: 'WORKSPACE_ID', value: workspaceId }
        {
          name: 'STORAGE_CONNECTION_STRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        { name: 'ENVIRONMENT', value: 'production' }
        { name: 'FRONTEND_ORIGIN', value: 'https://${staticWebApp.properties.defaultHostname}' }
        { name: 'LOCAL_JWT_SECRET', value: localJwtSecret }
        { name: 'LOCAL_SUPER_ADMIN_EMAILS', value: localSuperAdminEmails }
      ]
    }
  }
}

// ── Link SWA → Function App (backend proxy) ──────────────────
// Routes /api/* from the SWA to the Function App
resource swaBackend 'Microsoft.Web/staticSites/linkedBackends@2022-09-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: functionApp.id
    region: location
  }
}

// ── RBAC: Function App Managed Identity → Log Analytics Reader
var logAnalyticsReaderRoleId = '73c42c96-874c-492b-b04d-ab87d138a893'

resource logAnalyticsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, logAnalyticsReaderRoleId, workspaceResourceId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', logAnalyticsReaderRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── RBAC: Function App Managed Identity → Sentinel Reader ────
var sentinelReaderRoleId = '8d289c81-5571-4d40-9915-34b6d0b6e568'

resource sentinelRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, sentinelReaderRoleId, resourceGroup().id)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', sentinelReaderRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── RBAC: Function App Managed Identity → Storage Table Data Contributor
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

resource storageTableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, storageTableDataContributorRoleId, storageAccount.id)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Outputs ──────────────────────────────────────────────────
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output functionAppPrincipalId string = functionApp.identity.principalId

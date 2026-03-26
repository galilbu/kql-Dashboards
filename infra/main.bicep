targetScope = 'resourceGroup'

@description('Base name for all resources')
param baseName string = 'kqldash'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Entra ID tenant ID')
param tenantId string

@description('Entra ID app client ID')
param clientId string

@secure()
@description('Entra ID app client secret')
param clientSecret string

@description('Log Analytics workspace ID for KQL queries')
param workspaceId string

@description('Log Analytics workspace resource ID (for RBAC assignment)')
param workspaceResourceId string

@secure()
@description('Secret for signing local JWTs (min 32 chars). Generate: python -c "import secrets; print(secrets.token_hex(32))"')
param localJwtSecret string = ''

@description('Comma-separated emails with local super-admin rights')
param localSuperAdminEmails string = ''

// ── Storage Account ─────────────────────────────────────────
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${baseName}stor'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource dashboardsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'Dashboards'
}

resource permissionsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'DashboardPermissions'
}

resource localUsersTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'LocalUsers'
}

resource localInvitesTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'LocalInvites'
}

// ── App Service Plan (Consumption) ──────────────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${baseName}-plan'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Linux
  }
}

// ── Function App ────────────────────────────────────────────
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
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'custom' }
        { name: 'TENANT_ID', value: tenantId }
        { name: 'CLIENT_ID', value: clientId }
        { name: 'CLIENT_SECRET', value: clientSecret }
        { name: 'WORKSPACE_ID', value: workspaceId }
        { name: 'STORAGE_CONNECTION_STRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'ENVIRONMENT', value: 'production' }
        { name: 'LOCAL_JWT_SECRET', value: localJwtSecret }
        { name: 'LOCAL_SUPER_ADMIN_EMAILS', value: localSuperAdminEmails }
      ]
    }
  }
}

// ── Static Web App ──────────────────────────────────────────
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${baseName}-swa'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      appLocation: 'frontend'
      apiLocation: 'api'
      outputLocation: 'dist'
    }
  }
}

// ── RBAC: Log Analytics Reader on workspace ─────────────────
// Role definition ID for "Log Analytics Reader"
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

// ── RBAC: Microsoft Sentinel Reader on resource group ───────
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

// ── Outputs ─────────────────────────────────────────────────
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output functionAppName string = functionApp.name
output storageAccountName string = storageAccount.name
output functionAppPrincipalId string = functionApp.identity.principalId

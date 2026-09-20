data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                = "kv-${local.name}-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  # Moderne RBAC-toegang in plaats van de oudere access policies: wie een
  # secret mag lezen of schrijven, wordt geregeld met azurerm_role_assignment.
  enable_rbac_authorization = true

  # Dev-schaal team-app: geen purge protection, zodat 'terraform destroy'
  # de vault ook echt weggooit in plaats van 90 dagen te laten 'soft-deleted'
  # blijven staan. Zet dit op true zodra dit productie wordt.
  purge_protection_enabled = false
  soft_delete_retention_days = 7

  tags = local.tags
}

# Wie 'terraform apply' draait (de federated GitHub Actions-identity) moet
# zelf ook de secret mogen schrijven — Contributor op de subscription dekt
# alleen het beheervlak van de Key Vault, niet de databewerkingen op de
# secrets zelf onder RBAC-autorisatie.
resource "azurerm_role_assignment" "deployer_kv_secrets_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# De Container App leest de secret via zijn managed identity, alleen om te lezen.
resource "azurerm_role_assignment" "app_kv_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

resource "azurerm_key_vault_secret" "database_url" {
  name         = "database-url"
  key_vault_id = azurerm_key_vault.main.id
  value        = "postgres://${azurerm_postgresql_flexible_server.main.administrator_login}:${urlencode(random_password.postgres_admin.result)}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?sslmode=require"

  depends_on = [azurerm_role_assignment.deployer_kv_secrets_officer]
}

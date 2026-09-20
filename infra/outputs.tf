output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "container_registry" {
  value = azurerm_container_registry.main.login_server
}

output "container_app_name" {
  value = azurerm_container_app.main.name
}

output "app_url" {
  value = "https://${azurerm_container_app.main.ingress[0].fqdn}"
}

output "postgres_server_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "key_vault_name" {
  value = azurerm_key_vault.main.name
}

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

output "custom_domain_verification_id" {
  description = "Waarde voor de TXT-record asuid.<eigen domein>."
  value       = azurerm_container_app_environment.main.custom_domain_verification_id
}

output "custom_domain_cname_target" {
  description = "Waar de CNAME van het eigen domein naar moet wijzen."
  value       = azurerm_container_app.main.ingress[0].fqdn
}

output "email_dns_records" {
  description = "DNS-records die in ZoneEdit moeten om het maildomein te verifiëren."
  value = {
    for k, r in azurerm_email_communication_service_domain.main.verification_records[0] :
    k => r[0] if length(r) > 0
  }
}

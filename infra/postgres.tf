# De wachtwoord van de server-admin komt nergens in de state als plaintext
# terug in outputs; hij wordt direct in de Key Vault-secret verwerkt (zie
# keyvault.tf) en verder nergens gebruikt.
resource "random_password" "postgres_admin" {
  length      = 24
  special     = true
  min_upper   = 2
  min_lower   = 2
  min_numeric = 2
  # Flexible Server accepteert niet elk speciaal teken; deze set is veilig
  # voor gebruik in een connectiestring zonder verdere escaping.
  override_special = "-_."
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "psql-${local.name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  version             = var.postgres_version

  administrator_login    = "appadmin"
  administrator_password = random_password.postgres_admin.result

  sku_name   = var.postgres_sku_name
  storage_mb = var.postgres_storage_mb

  # Expliciet, in plaats van op de provider-default te vertrouwen: bereikbaar
  # via een publiek endpoint, maar alleen voor wie een firewall-regel heeft
  # (hieronder alleen Azure-diensten — zie de firewall-regel verderop).
  public_network_access_enabled = true

  # Geen aparte availability zone gevraagd: voor een dev/team-schaal app is
  # de ingebouwde SLA van Flexible Server voldoende en scheelt dit kosten.
  zone = null

  # Voor een kleine teamapp is een dagelijkse back-up met 7 dagen bewaring ruim genoeg.
  backup_retention_days = 7

  tags = local.tags

  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "teams"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Speciale regel (0.0.0.0–0.0.0.0): staat toegang toe vanuit Azure-diensten,
# waaronder de Container App-omgeving. Er is bewust geen bredere regel voor
# toegang vanaf het publieke internet; wie lokaal tegen deze server wil
# werken, gebruikt 'az postgres flexible-server connect' of zet tijdelijk een
# eigen firewall-regel met het IP van dat moment.
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

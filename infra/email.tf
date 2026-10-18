# E-mailnotificaties via Azure Communication Services, vanaf
# noreply@<email_domain>. Dat is een ander subdomein dan dat van de app: op
# teams.monkel.com staat een CNAME, en daarnaast mogen geen TXT-records voor
# verificatie en SPF staan. Het domein moet eerst in DNS geverifieerd zijn
# voordat de communication service het mag gebruiken, dus dit gaat in twee
# stappen (zie README, "E-mail"):
#   1. apply met email_domain_verified = false: maakt de services en het domein
#      aan; output email_dns_records zegt welke records in ZoneEdit moeten.
#   2. records zetten, verifiëren, dan email_domain_verified = true: koppelt
#      het domein en zet de mailinstellingen op de Container App.

resource "azurerm_email_communication_service" "main" {
  name                = "ecs-${local.name}"
  resource_group_name = azurerm_resource_group.main.name
  data_location       = "Europe"
  tags                = local.tags
}

resource "azurerm_email_communication_service_domain" "main" {
  name              = var.email_domain
  email_service_id  = azurerm_email_communication_service.main.id
  domain_management = "CustomerManaged"
  tags              = local.tags
}

resource "azurerm_email_communication_service_domain_sender_username" "noreply" {
  name                    = "noreply"
  email_service_domain_id = azurerm_email_communication_service_domain.main.id
  display_name            = "Team S planning"
}

# De hostnaam van een communication service is globaal uniek, vandaar de suffix.
resource "azurerm_communication_service" "main" {
  name                = "acs-${local.name}-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  data_location       = "Europe"
  tags                = local.tags
}

resource "azurerm_communication_service_email_domain_association" "main" {
  count                    = var.email_domain_verified ? 1 : 0
  communication_service_id = azurerm_communication_service.main.id
  email_service_domain_id  = azurerm_email_communication_service_domain.main.id
}

# De app verstuurt mail met zijn managed identity, dus zonder connectiestring.
resource "azurerm_role_assignment" "app_acs_email" {
  scope                = azurerm_communication_service.main.id
  role_definition_name = "Communication and Email Service Owner"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

locals {
  name = "${var.project}-${var.environment}"
  tags = merge({
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }, var.tags)
}

# ACR-namen zijn globaal uniek en mogen geen streepjes bevatten.
resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = local.tags
}

resource "azurerm_container_registry" "main" {
  name                = "acr${var.project}${var.environment}${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_application_insights" "main" {
  name                = "appi-${local.name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.tags
}

# De app haalt images uit ACR met deze identity, dus geen registry-wachtwoorden.
resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${local.name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.name}"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.tags

  # Azure maakt nieuwe environments met workload profiles aan en zet daar zelf
  # het Consumption-profiel in. Staat het hier niet, dan wil elke plan het
  # weghalen.
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

resource "azurerm_container_app" "main" {
  name                         = "ca-${local.name}"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "database-url"
    key_vault_secret_id = azurerm_key_vault_secret.database_url.id
    identity            = azurerm_user_assigned_identity.app.id
  }

  # Deze twee secrets zet je met de hand in Key Vault (zie README, "Login"),
  # zodat het client secret en de e-mailadressen nooit in Terraform-state of
  # in deze publieke repo staan. Versieloze verwijzing: een nieuwe versie in
  # Key Vault wordt vanzelf opgepikt.
  secret {
    name                = "entra-client-secret"
    key_vault_secret_id = "${azurerm_key_vault.main.vault_uri}secrets/entra-client-secret"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "team-emails"
    key_vault_secret_id = "${azurerm_key_vault.main.vault_uri}secrets/team-emails"
    identity            = azurerm_user_assigned_identity.app.id
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name = "app"
      # Placeholder voor de allereerste apply: de deploy-workflow zet hier
      # daarna het echte image neer.
      image  = "mcr.microsoft.com/k8se/quickstart:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "APP_ENV"
        value = var.environment
      }

      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = azurerm_application_insights.main.connection_string
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name        = "TEAM_EMAILS"
        secret_name = "team-emails"
      }

      env {
        name  = "APP_URL"
        value = var.custom_domain == "" ? "" : "https://${var.custom_domain}"
      }

      # Mailinstellingen pas zodra het maildomein gekoppeld is (email.tf);
      # zonder ACS_ENDPOINT verstuurt de app niets en logt hij alleen.
      dynamic "env" {
        for_each = var.email_domain_verified ? {
          ACS_ENDPOINT    = "https://${azurerm_communication_service.main.hostname}"
          MAIL_FROM       = "noreply@${var.custom_domain}"
          AZURE_CLIENT_ID = azurerm_user_assigned_identity.app.client_id
        } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      liveness_probe {
        transport = "HTTP"
        port      = 8080
        path      = "/api/health"
      }

      readiness_probe {
        transport = "HTTP"
        port      = 8080
        path      = "/api/health"
      }
    }
  }

  # Het image wordt buiten Terraform om bijgewerkt door de deploy-workflow.
  lifecycle {
    ignore_changes = [template[0].container[0].image]
  }

  depends_on = [azurerm_role_assignment.acr_pull, azurerm_role_assignment.app_kv_secrets_user, azurerm_key_vault_secret.database_url]
}

# Eigen domein op de Container App. Terraform voegt alleen de hostnaam toe;
# het gratis managed certificaat koppel je daarna met
# `az containerapp hostname bind` (de azurerm-provider kan dat nog niet zelf).
# Daarom negeert Terraform de certificaatvelden, anders haalt de volgende apply
# de koppeling weer weg.
resource "azurerm_container_app_custom_domain" "main" {
  count            = var.custom_domain == "" ? 0 : 1
  name             = var.custom_domain
  container_app_id = azurerm_container_app.main.id

  lifecycle {
    ignore_changes = [certificate_binding_type, container_app_environment_certificate_id]
  }
}

# Login via Entra ID met de ingebouwde authenticatie van Container Apps: niemand
# komt bij de app zonder in te loggen, en de API leest wie er is ingelogd uit
# de X-MS-CLIENT-PRINCIPAL-header die het platform zet (en die een client niet
# zelf kan meesturen). De app registration zelf staat buiten Terraform, omdat
# de GitHub Actions-identity geen rechten in Entra heeft; zie README.
resource "azapi_resource" "auth" {
  type      = "Microsoft.App/containerApps/authConfigs@2024-03-01"
  name      = "current"
  parent_id = azurerm_container_app.main.id

  body = {
    properties = {
      platform = { enabled = true }
      globalValidation = {
        unauthenticatedClientAction = "RedirectToLoginPage"
        redirectToProvider          = "azureactivedirectory"
        # De deploy-workflow checkt de health via de publieke URL.
        excludedPaths = ["/api/health"]
      }
      identityProviders = {
        azureActiveDirectory = {
          enabled = true
          registration = {
            clientId                = var.entra_client_id
            clientSecretSettingName = "entra-client-secret"
            openIdIssuer            = "https://login.microsoftonline.com/${data.azurerm_client_config.current.tenant_id}/v2.0"
          }
        }
      }
      httpSettings = { requireHttps = true }
    }
  }
}

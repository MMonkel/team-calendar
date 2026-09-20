terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.14"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state in Azure Storage. Vul deze waarden in met het bootstrap-script
  # (zie docs/bootstrap.md) en commit ze; er staan geen secrets in.
  backend "azurerm" {
    resource_group_name  = "rg-tfstate"
    storage_account_name = "sttfstate394729473"
    container_name       = "tfstate"
    key                  = "app.tfstate"
    use_oidc             = true
  }
}

provider "azurerm" {
  features {}
  use_oidc = true

  # azurerm 4.x registreert standaard alleen een kernset resource providers.
  # Key Vault en Postgres Flexible Server staan hier expliciet bij zodat een
  # verse subscription niet faalt op een niet-geregistreerde provider.
  resource_providers_to_register = [
    "Microsoft.KeyVault",
    "Microsoft.DBforPostgreSQL",
  ]
}

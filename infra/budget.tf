# Maandbudget op de hele subscription, met mail aan de Owner(s) van de
# subscription. Via de rol in plaats van een vast adres, zodat er geen
# e-mailadres in deze publieke repo hoeft.
#   - Forecasted 100%: Azure verwacht dat de maand boven het budget uitkomt.
#   - Actual 80% en 100%: de werkelijke kosten zijn er (bijna).
resource "azurerm_consumption_budget_subscription" "monthly" {
  name            = "budget-monthly"
  subscription_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}"
  amount          = var.monthly_budget_eur
  time_grain      = "Monthly"

  time_period {
    # Moet de eerste van een maand zijn; daarna loopt het budget elke maand door.
    start_date = "2026-10-01T00:00:00Z"
  }

  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 100
    threshold_type = "Forecasted"
    contact_roles  = ["Owner"]
  }

  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 80
    threshold_type = "Actual"
    contact_roles  = ["Owner"]
  }

  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 100
    threshold_type = "Actual"
    contact_roles  = ["Owner"]
  }
}

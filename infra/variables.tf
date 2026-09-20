variable "project" {
  description = "Korte naam van het project, gebruikt in resource-namen (alleen kleine letters en cijfers)."
  type        = string
  default     = "starter"

  validation {
    condition     = can(regex("^[a-z0-9]{3,12}$", var.project))
    error_message = "Gebruik 3 tot 12 kleine letters of cijfers."
  }
}

variable "environment" {
  description = "Omgevingsnaam, bijvoorbeeld dev of prod."
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure-regio."
  type        = string
  default     = "swedencentral"
}

variable "min_replicas" {
  description = "Minimum aantal draaiende replicas. 0 betekent schalen naar nul als er geen verkeer is."
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum aantal replicas."
  type        = number
  default     = 3
}

variable "tags" {
  description = "Tags op alle resources."
  type        = map(string)
  default     = {}
}

variable "postgres_sku_name" {
  description = "SKU van de Postgres Flexible Server. B_Standard_B1ms is de goedkoopste burstable-tier, ruim genoeg voor een team van deze omvang."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  description = "Opslag in MB voor de Postgres-server. 32768 (32 GB) is het minimum dat Flexible Server toestaat."
  type        = number
  default     = 32768
}

variable "postgres_version" {
  description = "Postgres-major-versie."
  type        = string
  default     = "16"
}

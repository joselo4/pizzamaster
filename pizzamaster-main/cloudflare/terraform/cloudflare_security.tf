# Plantilla Terraform Cloudflare - seguridad perimetral
# Requiere provider cloudflare y una variable var.zone_id.
# Valida primero en staging para no afectar tráfico legítimo.

variable "zone_id" {
  type = string
}

# SSL/TLS Full Strict, Always HTTPS y HSTS suelen gestionarse como zone settings.
# Según versión del provider, puede variar el recurso disponible.
# Si tu provider no soporta alguno, actívalo desde Dashboard.

resource "cloudflare_ruleset" "custom_security_challenges" {
  zone_id = var.zone_id
  name    = "custom-security-managed-challenges"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules {
    action      = "managed_challenge"
    expression  = "(cf.threat_score ge 15) or (not cf.client.bot and http.request.method in {\"POST\" \"PUT\" \"PATCH\" \"DELETE\"} and cf.threat_score ge 10)"
    description = "Managed Challenge para tráfico sospechoso"
    enabled     = true
  }

  rules {
    action      = "block"
    expression  = "http.request.uri.path in {\"/.env\" \"/.git\" \"/wp-admin\" \"/phpmyadmin\" \"/adminer\" \"/database.sql\" \"/backup.zip\"} or starts_with(http.request.uri.path, \"/.git/\") or starts_with(http.request.uri.path, \"/wp-admin/\") or starts_with(http.request.uri.path, \"/phpmyadmin/\")"
    description = "Bloqueo de rutas sensibles comunes"
    enabled     = true
  }
}

# Rate Limiting Ruleset - rutas críticas
resource "cloudflare_ruleset" "rate_limits" {
  zone_id = var.zone_id
  name    = "rate-limits-login-admin-api"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules {
    action      = "managed_challenge"
    description = "Rate limit login"
    expression  = "starts_with(http.request.uri.path, \"/login\")"
    enabled     = true
    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 600
    }
  }

  rules {
    action      = "managed_challenge"
    description = "Rate limit admin"
    expression  = "starts_with(http.request.uri.path, \"/admin\")"
    enabled     = true
    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 600
    }
  }

  rules {
    action      = "managed_challenge"
    description = "Rate limit api"
    expression  = "starts_with(http.request.uri.path, \"/api/\")"
    enabled     = true
    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 120
      mitigation_timeout  = 600
    }
  }
}

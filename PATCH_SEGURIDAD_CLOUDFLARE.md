# Patch de seguridad Cloudflare

Fecha: 2026-05-03 19:14 UTC

Aplicado sin tocar lógica de React/Supabase:

- Cabeceras de seguridad/HSTS en `public/_headers`.
- Bloqueo 404 de rutas sensibles comunes en `public/_redirects`.
- Fallback SPA conservado para no romper rutas internas.
- Plantillas y guía Cloudflare en `cloudflare/`.

Pendiente fuera del código: activar en Cloudflare Dashboard o Terraform/API:

- SSL/TLS: Full (strict).
- Always Use HTTPS.
- HSTS solo si HTTPS ya está OK en todo el sitio.
- WAF Managed Rules.
- OWASP Core Ruleset.
- Rate limiting para `/login*`, `/admin*`, `/api/*`.
- Managed Challenge para tráfico sospechoso.
- Bloqueo por país solo si el negocio no requiere tráfico internacional.

## Nota adicional de seguridad

Se retiraron archivos `.env` reales del ZIP entregable y se conserva/crea `.env.example` para evitar exponer credenciales. Configura las variables reales en el hosting o en tu entorno local.

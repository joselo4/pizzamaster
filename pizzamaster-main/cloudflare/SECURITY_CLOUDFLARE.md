# Configuración de seguridad Cloudflare aplicada/recomendada

Este proyecto ya queda preparado con cabeceras y bloqueos estáticos seguros en `public/_headers` y `public/_redirects`.

> Importante: las opciones **SSL/TLS Full (strict)**, **Always Use HTTPS**, **WAF Managed Rules**, **OWASP ruleset**, **Rate Limiting** y **Managed Challenge** se activan en Cloudflare a nivel de zona/dominio. No se pueden forzar desde React/Vite sin credenciales de Cloudflare. Por eso se incluye esta guía y plantillas IaC/API para aplicarlas sin tocar la lógica del sistema.

## 1. SSL/TLS

En Cloudflare Dashboard:

1. **SSL/TLS > Overview**: seleccionar **Full (strict)**.
2. **SSL/TLS > Edge Certificates**: activar **Always Use HTTPS**.
3. **SSL/TLS > Edge Certificates > HSTS**: activar solo si todo el dominio y subdominios funcionan bien por HTTPS.
   - `max-age`: 12 meses.
   - `includeSubDomains`: activar solo si los subdominios también soportan HTTPS.
   - `preload`: activar solo si estás seguro de mantener HTTPS permanente.

El proyecto ya envía:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## 2. WAF Managed Rules + OWASP

En Cloudflare Dashboard:

1. **Security > WAF > Managed rules**.
2. Activar **Cloudflare Managed Ruleset**.
3. Activar **Cloudflare OWASP Core Ruleset**.
4. Recomendación inicial: usar modo predeterminado/managed y revisar eventos antes de endurecer a bloqueo agresivo.

## 3. Rate limiting recomendado

Crear reglas para:

- `/login*`
- `/admin*`
- `/api/*`

Valores conservadores para no romper usuarios reales:

- Login/Admin: 10 solicitudes por minuto por IP → **Managed Challenge** o **Block** por 10 minutos.
- API: 120 solicitudes por minuto por IP → **Managed Challenge** o **Block** por 10 minutos.

## 4. Managed Challenge para tráfico sospechoso

Crear una WAF Custom Rule con acción **Managed Challenge** para señales de riesgo, por ejemplo:

```txt
(cf.threat_score ge 15) or (not cf.client.bot and http.request.method in {"POST" "PUT" "PATCH" "DELETE"} and cf.threat_score ge 10)
```

## 5. Bloqueo de países

No se aplicó bloqueo por país dentro del proyecto porque puede afectar clientes, delivery, proveedores, soporte o usuarios fuera del país.

Si el negocio solo atiende Perú, puedes crear una regla Cloudflare opcional:

```txt
(ip.geoip.country ne "PE")
```

Acción sugerida: **Managed Challenge** antes de usar **Block**.

## 6. Rutas sensibles bloqueadas en el despliegue estático

Se añadieron reglas 404 para rutas típicas sensibles/no necesarias:

- `/.env`
- `/.env*`
- `/.git`
- `/.git/*`
- `/wp-admin`
- `/wp-admin/*`
- `/phpmyadmin`
- `/phpmyadmin/*`
- `/adminer`
- `/adminer*`
- `/database.sql`
- `/backup.zip`

No se bloqueó `/admin` porque el proyecto sí usa panel administrativo.

## 7. Archivos incluidos

- `public/_headers`: CSP, HSTS y cabeceras de seguridad.
- `public/_redirects`: bloqueo 404 de rutas sensibles y fallback SPA.
- `cloudflare/security-rules.json`: plantilla de reglas para documentar/importar manualmente.
- `cloudflare/terraform/cloudflare_security.tf`: plantilla Terraform para aplicar en Cloudflare con variables.

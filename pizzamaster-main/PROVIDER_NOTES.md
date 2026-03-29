# PROVIDER_NOTES

## Si usas Cloudflare / CDN
- Mantén HTTPS obligatorio y activa redirección automática a HTTPS.
- Si el proveedor permite transformar/ocultar headers, allí se gestiona el header `Server`.

## Si usas Render / Nginx / Apache
- Asegúrate de que los headers de seguridad salgan como headers HTTP reales en producción.
- Prioriza las reglas `/administrator/*` y `/user/login` antes del fallback SPA a `/index.html`.
- Verifica que no exista ningún listener en `:8080` expuesto públicamente.

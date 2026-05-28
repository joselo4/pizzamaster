# SECURITY_HARDENING_V3

## Implementado en este ZIP
- Headers reales para producción/hosting estático: `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.
- Compatibilidad de desarrollo con Vite/React (`vite dev`) sin romper Fast Refresh.
- Reglas para bloquear públicamente `/administrator/*` y `/user/login` devolviendo `404.html`.
- `robots.txt` neutral: ya no menciona rutas sensibles como `admin`.
- `.env` saneado y `.gitignore` reforzado.

## Lo que NO puede resolver un ZIP por sí solo
- Puerto 8080 abierto: se cierra en infraestructura (firewall, contenedor, reverse proxy o panel del hosting).
- Header `Server: cloudflare`: depende del proveedor/CDN.
- HSTS solo surte efecto si el sitio final se sirve por HTTPS real.

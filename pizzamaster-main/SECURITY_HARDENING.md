# SECURITY_HARDENING_V2

## Qué corrige esta versión
- **Dev CSP compatible con Vite/React**: permite el preámbulo inline de `@vitejs/plugin-react` y conexiones `ws://localhost:*` solo en `vite dev`.
- **Prod/preview CSP estricta**: usa `script-src 'self'` y `connect-src` corregido con `https://*.ingest.sentry.io`.
- **Sin `frame-ancestors` en meta**: esta directiva se deja únicamente por header, porque el navegador la ignora dentro de `<meta http-equiv="Content-Security-Policy">`.
- Se mantiene `public/_headers`, `robots.txt`, `_redirects` y `404.html` para endurecimiento en hosting estático.

## Nota importante
En desarrollo (`npm run dev`) verás una CSP más permisiva por necesidad técnica de Vite. En producción/preview se aplica la política estricta. No reutilices la CSP de desarrollo en producción.

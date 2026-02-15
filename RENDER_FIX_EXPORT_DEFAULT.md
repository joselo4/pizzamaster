# Fix Render: "export default /assets/index-xxxx.html" (pantalla blanca)

Este síntoma ocurre cuando el build está usando un Vite no estándar (alias `npm:rolldown-vite`) por culpa del `package-lock.json`.

## Qué hacer en Render (Static Site)
1. **Build Command**: `bash render-build.sh`
2. **Publish Directory**: `dist`

El script `render-build.sh` borra `package-lock.json` y ejecuta `npm install` + `npm run build` para que Render instale **Vite oficial**.

## Rewrites (SPA)
En Render → Redirects/Rewrites:
- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

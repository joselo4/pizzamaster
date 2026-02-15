# Render (Static Site) - Arreglo de pantalla blanca

## Síntoma
Ves el texto: `export default "/assets/index-xxxx.html"` y Quirks Mode.
Eso significa que tu `dist/index.html` NO es HTML.

## Configuración en Render
- **Build Command**: `bash render-build.sh`
- **Publish Directory**: `dist`

## Importante
En Render → Manual Deploy → **Clear build cache & deploy** (para borrar caché). citeturn40search69

## SPA Rewrite
En Render → Redirects/Rewrites:
- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

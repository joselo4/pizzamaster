# Render (Static Site)

## Settings
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

## SPA Rewrite (obligatorio para /admin/dashboard y /cashier/history)
Render Dashboard → Redirects/Rewrites:
- Source Path: `/*`
- Destination Path: `/index.html`
- Action: `Rewrite`

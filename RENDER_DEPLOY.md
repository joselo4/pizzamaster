# Deploy en Render (Static Site)

## 1) Configuración recomendada

- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

> Vite genera el build estático en `dist/` por defecto. Consulta la guía oficial de Vite para despliegue estático.

## 2) Rewrites para SPA (React Router)

En Render Dashboard → **Redirects/Rewrites** agrega:

- **Source**: `/*`
- **Destination**: `/index.html`
- **Action**: `Rewrite`

Esto hace que rutas como `/admin/dashboard` funcionen al refrescar.

## 3) Verificación

Después de `npm run build`, el archivo `dist/index.html` debe empezar con:

```html
<!DOCTYPE html>
```

Si tu `dist/index.html` contiene algo como `export default "/assets/index-xxxx.html"`, entonces el proyecto estaba usando un Vite no estándar. Este repo ya vuelve a Vite oficial.

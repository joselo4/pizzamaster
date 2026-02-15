# Sentry (Real)

Este proyecto inicializa Sentry solo si existe `VITE_SENTRY_DSN` en tu `.env`.

## Pasos
1) Instalar dependencias:

```bash
npm install
```

2) Configurar `.env`:

```env
VITE_SENTRY_DSN=TU_DSN
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

Si `VITE_SENTRY_DSN` está vacío, Sentry no se inicializa.

> Nota: `npm ls @sentry/react` debe mostrar una versión. Si sale `(empty)`, ejecuta `npm install`.

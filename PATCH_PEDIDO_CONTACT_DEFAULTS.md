# Parche /pedido: contactos robustos + categoría inicial + refresco + badge DEV

## Qué incluye
- Lectura robusta de **store_wa/store_phone** con fallbacks a claves antiguas.
- **Categoría inicial** desde `pedido_default_category` con fallback a `pedido_default_tab` o `pedido_categoria_inicial`.
- Aplicación de la default **solo** si el usuario no eligió y no hay `?promo=`.
- **Botón Refrescar config** (flotante) — limpia cache local y fuerza relectura.
- **Badge DEV** (solo en `import.meta.env.DEV`): muestra la categoría por defecto detectada.

## SQL
`supabase_sql/20260308_rejection_reason.sql` — asegura `reject_reason` en `order_requests`/`orders`.

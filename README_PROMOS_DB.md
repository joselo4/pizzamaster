# ZIP Integrado — /promos editable (DB) + imágenes en Storage pizza-data

Este paquete deja listo **/promos** como módulo **independiente** de **/promo**.

- **/promo** (landing QR) sigue usando `config.promo_*` y `config.promo_promos` (NO se toca).
- **/promos** (catálogo) usa la tabla `public.promotions` con RLS.

## ¿Dónde se edita /promos?

En el panel **Admin**, pestaña **Promos DB** (`promos-db`).

## Imágenes (bucket público pizza-data)

En **Promos DB** puedes:

- Pegar URLs en `thumb_url` y `image_url`.
- O usar **Subir imagen** (opcional):
  - Comprime a WebP (thumb 480px, hero 1280px)
  - Sube a Supabase Storage bucket **pizza-data**:
    - `promos/thumb/...`
    - `promos/hero/...`

Como el bucket es público se usa `getPublicUrl()`.

## Fixes incluidos (quirúrgicos)

- Se corrige pantalla blanca: `PromoShow.tsx` ya **no navega durante render**.
- Se corrige UI de edición: inputs ahora usan `bg-white` + `text-gray-900` para que no se vean “blanco sobre blanco”.
- Se evita `<img src="">` en Admin (placeholder cuando no hay thumb).

## Storage policies (opcional)

Si quieres reforzar permisos en `pizza-data`, ejecuta:
- `supabase_sql/31_storage_pizza_data_public.sql`

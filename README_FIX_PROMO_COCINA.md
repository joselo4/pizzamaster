# Arreglos incluidos

## Ruta Promo
- Abre: /promo
- Campaña QR: /promo?ref=carlos

> Si te redirige a /pedido, significa que /promo no estaba en el router o tu hosting no hace rewrite.

## Admin: Editor de Promo
- Admin -> pestaña **promo**
- Allí editas textos, teléfono, whatsapp, etc.

## Cocina: Error al actualizar
Ejecuta en Supabase SQL Editor (en orden):
1) supabase_sql/07_orders_update_policy.sql
2) supabase_sql/08_orders_status_rpc.sql

## Promo config pública
Ejecuta:
- supabase_sql/10_promo_public_read_policy.sql

## Hosting (React Router)
Si en producción entra por URL directa a /promo y sale 404, configura un rewrite a /index.html.

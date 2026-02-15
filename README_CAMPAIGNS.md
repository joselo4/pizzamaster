# Estadísticas por Campaña (ref)

## 1) Ejecuta SQL
- `supabase_sql/migrations/20260216_01_promo_events_order_request.sql`
- `supabase_sql/migrations/20260216_02_campaign_stats_rpc.sql`

## 2) Genera datos
1) Abre: `/promo?ref=carlos`
2) Luego: `/pedido?ref=carlos`
3) Envía un pedido (crea order_request)

## 3) Ver en Dashboard
- Abre: `/admin/dashboard`
- Cambia el filtro: 7 días / 30 días

Si no ves datos, revisa tabla `promo_events` y RLS.

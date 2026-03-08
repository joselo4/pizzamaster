
# ZIP Integral (quirúrgico) - 2026-02-15

## Qué se añadió
- Observabilidad unificada: `src/lib/logger.ts` + handler global en `src/main.tsx`.
- SEO dinámico: `src/lib/seo.ts` y hooks en páginas de promo.
- Dashboard: `src/pages/AdminDashboard.tsx` y ruta `/admin/dashboard`.
- /pedido mejora de actualización:
  - Realtime a `public.config` (tiempo estimado / costo de envío).
  - Captura `?promo=CODIGO` para enfocar la pestaña Promo y adjuntar a notas.
  - Botón `Refrescar`.
- Migraciones ordenadas: `supabase_sql/migrations/*`.

## Cómo verificar rápido
1) En el ZIP existe `INTEGRAL_CHANGELOG.md`.
2) Existe `src/lib/logger.ts`.
3) Existe `supabase_sql/migrations/20260215_01_event_log.sql`.
4) En `src/pages/CustomerOrder.tsx` verás `promoCode` y `config-realtime`.

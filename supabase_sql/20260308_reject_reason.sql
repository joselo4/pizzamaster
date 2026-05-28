-- 2026-03-08: Campo opcional para motivo de rechazo (quirúrgico, idempotente)

alter table if exists public.order_requests
  add column if not exists reject_reason text;

alter table if exists public.orders
  add column if not exists reject_reason text;

-- Si PostgREST no refleja el cambio:
-- select pg_notify('pgrst','reload schema');

-- 2026-03-08: Campo opcional para motivo de rechazo (quirúrgico, idempotente)
alter table if exists public.orders
  add column if not exists reject_reason text;

alter table if exists public.order_requests
  add column if not exists reject_reason text;

-- Nota: Mantener RLS existente; la exposición pública del motivo se hace vía RPC de tracking
-- (se recomienda extender rpc_track_order para devolver reject_reason solo cuando status='Rechazado').
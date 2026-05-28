-- 2026-03-08: Campo opcional para motivo de rechazo (quirúrgico, idempotente)
alter table if exists public.orders
  add column if not exists reject_reason text;

alter table if exists public.order_requests
  add column if not exists reject_reason text;

-- Nota: La exposición pública del motivo se hace vía Track (sin PII) y solo cuando status='Rechazado'.
-- Si usas RPC de tracking, puedes extenderla para incluir reject_reason solo en ese estado.
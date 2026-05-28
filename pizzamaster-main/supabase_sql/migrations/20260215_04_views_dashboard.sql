
-- 20260215_04_views_dashboard.sql
create or replace view public.v_events_last_24h as
  select * from public.event_log where created_at >= now() - interval '24 hours';

create or replace view public.v_orders_last_24h as
  select id, status, total, service_type, created_at from public.orders where created_at >= now() - interval '24 hours';

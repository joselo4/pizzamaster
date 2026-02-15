-- 22_promo_events_extend.sql
-- Extiende promo_events para métricas (no destructivo)

alter table if exists public.promo_events
  add column if not exists session_id text,
  add column if not exists utm jsonb,
  add column if not exists device jsonb,
  add column if not exists user_agent text,
  add column if not exists meta jsonb;

create index if not exists promo_events_campaign_id_idx on public.promo_events(campaign_id);
create index if not exists promo_events_event_idx on public.promo_events(event);
create index if not exists promo_events_created_at_idx on public.promo_events(created_at);
create index if not exists promo_events_session_id_idx on public.promo_events(session_id);

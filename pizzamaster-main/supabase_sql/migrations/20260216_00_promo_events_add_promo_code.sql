-- 20260216_00_promo_events_add_promo_code.sql
alter table if exists public.promo_events
  add column if not exists promo_code text null;

create index if not exists promo_events_promo_code_created_idx
on public.promo_events (promo_code, created_at desc);

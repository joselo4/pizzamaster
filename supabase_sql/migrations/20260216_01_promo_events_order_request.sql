-- 20260216_01_promo_events_order_request.sql
alter table if exists public.promo_events enable row level security;

drop policy if exists promo_events_anon_insert on public.promo_events;
create policy promo_events_anon_insert
on public.promo_events
for insert to anon
with check (
  event in ('view','pedido_visit','order_request')
  and char_length(campaign_id) between 1 and 64
  and (ref is null or char_length(ref) <= 64)
  and (path is null or char_length(path) <= 200)
  and (promo_code is null or char_length(promo_code) <= 64)
);

create index if not exists promo_events_event_campaign_created_idx
on public.promo_events (event, campaign_id, created_at desc);

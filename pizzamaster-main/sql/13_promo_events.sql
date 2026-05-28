-- 13_promo_events.sql
-- Tracking de vistas y conversiones por campaña (/promo). Sin PII.

create table if not exists public.promo_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  event text not null default 'view',
  campaign_id text not null,
  ref text null,
  path text null
);

alter table public.promo_events enable row level security;

drop policy if exists promo_events_anon_insert on public.promo_events;
create policy promo_events_anon_insert
on public.promo_events
for insert to anon
with check (
  event in ('view','pedido_visit')
  and char_length(campaign_id) between 1 and 64
  and (ref is null or char_length(ref) <= 64)
  and (path is null or char_length(path) <= 200)
);

drop policy if exists promo_events_staff_select on public.promo_events;
create policy promo_events_staff_select
on public.promo_events
for select to public
using (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

revoke update, delete on public.promo_events from anon, public;

create index if not exists promo_events_campaign_created_idx
on public.promo_events (campaign_id, created_at desc);

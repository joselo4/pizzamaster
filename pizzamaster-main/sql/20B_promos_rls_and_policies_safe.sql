-- 20B_promos_rls_and_policies_safe.sql
-- RLS + policies robustas (compatibles con status y/o active).

alter table if exists public.promotions enable row level security;
alter table if exists public.promotion_codes enable row level security;
alter table if exists public.promotion_redemptions enable row level security;

drop policy if exists promotions_public_web_select on public.promotions;
create policy promotions_public_web_select
on public.promotions for select to anon
using (
  ((coalesce(status,'') = 'active') or (coalesce(active,false) = true))
  and (starts_at is null or now() >= starts_at)
  and (ends_at   is null or now() <= ends_at)
  and ('web' = any(channels))
);

drop policy if exists promotions_staff_rw on public.promotions;
create policy promotions_staff_rw
on public.promotions for all to public
using (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'))
with check (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

-- (Opcional) Si quieres códigos/redenciones sólo staff
drop policy if exists promotion_codes_staff_rw on public.promotion_codes;
create policy promotion_codes_staff_rw
on public.promotion_codes for all to public
using (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'))
with check (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

drop policy if exists promotion_redemptions_staff_rw on public.promotion_redemptions;
create policy promotion_redemptions_staff_rw
on public.promotion_redemptions for all to public
using (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'))
with check (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

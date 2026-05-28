-- 19_promotions_policies.sql
alter table public.promotions enable row level security;

-- Público (anon): solo activas y dentro de ventana (si aplica)
drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read
on public.promotions for select to anon
using (
  active = true
  and (starts_at is null or now() >= starts_at)
  and (ends_at   is null or now() <= ends_at)
);

-- Staff read
drop policy if exists promotions_staff_read on public.promotions;
create policy promotions_staff_read
on public.promotions for select to public
using (public.session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

-- Admin write
drop policy if exists promotions_admin_insert on public.promotions;
create policy promotions_admin_insert
on public.promotions for insert to public
with check (public.session_role() = 'Admin');

drop policy if exists promotions_admin_update on public.promotions;
create policy promotions_admin_update
on public.promotions for update to public
using (public.session_role() = 'Admin')
with check (public.session_role() = 'Admin');

drop policy if exists promotions_admin_delete on public.promotions;
create policy promotions_admin_delete
on public.promotions for delete to public
using (public.session_role() = 'Admin');

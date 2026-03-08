-- 12_fix_orders_staff_update_policy.sql
alter table if exists public.orders enable row level security;
drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update
on public.orders
for update
to public
using (public.session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'))
with check (public.session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

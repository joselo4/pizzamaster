-- 07_orders_update_policy.sql
-- Permite UPDATE en orders para roles staff (Cocina -> Horno, etc.)
-- Usa session_role() (debe existir en tu DB)

alter table if exists public.orders enable row level security;

drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update
on public.orders for update to public
using (session_role() in ('Admin','Kitchen','Delivery','Cashier','Validation'))
with check (session_role() in ('Admin','Kitchen','Delivery','Cashier','Validation'));

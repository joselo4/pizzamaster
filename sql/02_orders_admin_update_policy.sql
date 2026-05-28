
-- 02_orders_admin_update_policy.sql
-- Permite UPDATE en public.orders para ADMIN en cualquier estado.

drop policy if exists admin_update_orders on public.orders;
create policy admin_update_orders on public.orders
for update to authenticated
using (public.is_admin())
with check (true);

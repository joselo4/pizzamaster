
-- 04_orders_cashier_update_policy.sql
-- Permitir UPDATE de pedidos a CAJERO y ADMIN

create or replace function public.jwt_role() returns text
language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','');
$$;

drop policy if exists cashier_update_orders on public.orders;
create policy cashier_update_orders on public.orders
for update to authenticated
using (public.jwt_role() in ('CASHIER','ADMIN'))
with check (public.jwt_role() in ('CASHIER','ADMIN'));

-- Si el API no refleja cambios:
-- select pg_notify('pgrst','reload schema');

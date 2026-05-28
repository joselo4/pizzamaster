
-- 03_admin_update_order_rpc.sql
-- RPC opcional para parches controlados en orders.

create or replace function public.admin_update_order(
  p_id bigint,
  p_patch jsonb
) returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  update public.orders
  set
    customer_name = coalesce(p_patch->>'customer_name', customer_name),
    phone         = coalesce(p_patch->>'phone',         phone),
    status        = coalesce(p_patch->>'status',        status),
    notes         = coalesce(p_patch->>'notes',         notes),
    updated_at    = now()
  where id = p_id;
end$$;

revoke all on function public.admin_update_order(bigint, jsonb) from public;
grant execute on function public.admin_update_order(bigint, jsonb) to authenticated;

-- 08_orders_status_rpc.sql
-- RPC segura para actualizar el estado del pedido (evita fallas por RLS)
-- Solo roles staff permitidos via session_role()

create or replace function public.rpc_set_order_status(
  p_id bigint,
  p_status text
)
returns boolean
language plpgsql
security definer
as $$
begin
  if session_role() not in ('Admin','Kitchen','Delivery','Cashier','Validation') then
    raise exception 'No autorizado';
  end if;

  update public.orders
  set status = p_status
  where id = p_id;

  return found;
end;
$$;

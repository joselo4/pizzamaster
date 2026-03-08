-- 12_products_sort_order.sql
-- Orden personalizado de productos (Admin drag & drop)

alter table if exists public.products
  add column if not exists sort_index int;

-- RPC segura para actualizar orden en bloque
-- p_items: [{"id": "<uuid>", "index": 1}, ...]
create or replace function public.rpc_set_product_order(
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
set row_security = off
as $$
begin
  if coalesce(public.session_role(), '') <> 'Admin' then
    raise exception 'not authorized';
  end if;

  update public.products as p
  set sort_index = v.index
  from jsonb_to_recordset(p_items) as v(id uuid, index int)
  where p.id = v.id;
end;
$$;

revoke all on function public.rpc_set_product_order(jsonb) from public;
grant execute on function public.rpc_set_product_order(jsonb) to anon;
grant execute on function public.rpc_set_product_order(jsonb) to authenticated;

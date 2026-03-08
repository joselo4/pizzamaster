-- 03_rpc_create_order_request_public.sql
-- RPC pública para registrar pedidos web (order_requests)
-- Deja que Postgres genere public_token por DEFAULT (uuid)

create or replace function public.rpc_create_order_request_public(
  p_payload jsonb,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
set row_security = off
as $$
declare
  r public.order_requests;
begin
  insert into public.order_requests (
    service_type,
    customer_name,
    phone,
    address,
    notes,
    items,
    estimated_total,
    delivery_fee,
    estimated_minutes
  )
  values (
    coalesce(p_payload->>'service_type','Delivery'),
    nullif(trim(p_payload->>'customer_name'),''),
    trim(p_payload->>'phone'),
    nullif(trim(p_payload->>'address'),''),
    nullif(trim(p_payload->>'notes'),''),
    coalesce(p_payload->'items','[]'::jsonb),
    coalesce((p_payload->>'estimated_total')::numeric, 0),
    coalesce((p_payload->>'delivery_fee')::numeric, 0),
    nullif(p_payload->>'estimated_minutes','')::int
  )
  returning * into r;

  return jsonb_build_object('ok', true, 'request', to_jsonb(r));
exception when others then
  return jsonb_build_object('ok', false, 'message', sqlerrm);
end;
$$;

revoke all on function public.rpc_create_order_request_public(jsonb, text) from public;
grant execute on function public.rpc_create_order_request_public(jsonb, text) to anon;

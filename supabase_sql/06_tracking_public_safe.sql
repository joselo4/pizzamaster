
-- 06_tracking_public_safe.sql
-- Tracking público seguro SIN PII (compatible con Track.tsx)

create unique index if not exists order_requests_public_token_uidx
on public.order_requests(public_token);

create or replace function public.rpc_track_order_public(p_order_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select case
    when o.id is null then jsonb_build_object('ok', false, 'message', 'No encontrado')
    else jsonb_build_object(
      'ok', true,
      'order', jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'created_at', o.created_at,
        'service_type', o.service_type,
        'items', o.items,
        'total', o.total,
        'delivery_cost', o.delivery_cost,
        'payment_status', o.payment_status,
        'payment_method', o.payment_method,
        'final_payment_method', o.final_payment_method
      )
    )
  end
  from (select * from public.orders where id = p_order_id limit 1) o;
$$;

revoke all on function public.rpc_track_order_public(bigint) from public;
grant execute on function public.rpc_track_order_public(bigint) to anon;

create or replace function public.rpc_track_lookup_public(
  p_request_id bigint default null,
  p_public_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
set row_security = off
as $$
declare
  r public.order_requests;
  o public.orders;
  mapped bigint;
begin
  if p_request_id is not null then
    select * into r from public.order_requests where id = p_request_id limit 1;
  elsif p_public_token is not null then
    select * into r from public.order_requests where public_token = p_public_token limit 1;
  else
    return jsonb_build_object('ok', false, 'message', 'Token inválido');
  end if;

  if r.id is null then
    return jsonb_build_object('ok', false, 'message', 'No encontrado');
  end if;

  mapped := r.mapped_order_id;
  if mapped is not null then
    select * into o from public.orders where id = mapped limit 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'request', jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'created_at', r.created_at,
      'service_type', r.service_type,
      'items', r.items,
      'estimated_total', r.estimated_total,
      'delivery_fee', r.delivery_fee,
      'estimated_minutes', r.estimated_minutes,
      'mapped_order_id', r.mapped_order_id,
      'reject_reason', r.reject_reason
    ),
    'order', case when o.id is null then null else jsonb_build_object(
      'id', o.id,
      'status', o.status,
      'created_at', o.created_at,
      'service_type', o.service_type,
      'items', o.items,
      'total', o.total,
      'delivery_cost', o.delivery_cost,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method,
      'final_payment_method', o.final_payment_method
    ) end
  );
end;
$$;

revoke all on function public.rpc_track_lookup_public(bigint, uuid) from public;
grant execute on function public.rpc_track_lookup_public(bigint, uuid) to anon;

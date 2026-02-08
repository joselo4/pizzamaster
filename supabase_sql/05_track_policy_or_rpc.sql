-- 05_track_policy_or_rpc.sql
-- Opción A (rápida): permitir lectura pública de order_requests para que /track funcione.
-- ⚠️ Esto expone datos del pedido si alguien adivina IDs. Recomendado solo si lo aceptas.
--
-- alter table public.order_requests enable row level security;
-- create policy "anon can read order_requests for tracking" on public.order_requests
--   for select to anon using (true);
--
-- Opción B (recomendada): RPC segura que devuelve SOLO el registro buscado (por id) y la orden mapeada.
-- Ejecuta esta opción y luego puedes bloquear SELECT directo si quieres.

create or replace function public.rpc_track_lookup(
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

  return jsonb_build_object('ok', true, 'request', to_jsonb(r), 'order', to_jsonb(o));
end;
$$;

revoke all on function public.rpc_track_lookup(bigint, uuid) from public;
grant execute on function public.rpc_track_lookup(bigint, uuid) to anon;

-- 20260221_transfer_between_programs.sql
-- RPC: transfer_between_programs (TRANSFER / PRESTAMO / DEVOLUCION)
-- Garantiza:
-- 1) Movimientos OUT/IN registrados
-- 2) Actualiza batches.quantity_current correctamente
-- 3) IN cumple trg_validate_in_required (batch_id + provider/doc/costo + expiry)

create extension if not exists pgcrypto;

create or replace function public.transfer_between_programs(
  p_mode text,
  p_from_program text,
  p_to_program text,
  p_product_id bigint,
  p_batch_id bigint,
  p_quantity numeric,
  p_observation text,
  p_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  b_from record;
  b_to_id bigint;
  v_exp date;
  v_code text;
  v_cost numeric;
  v_obs_out text;
  v_obs_in text;
  v_mode text;
begin
  v_mode := upper(coalesce(p_mode,'TRANSFER'));
  if p_from_program is null or trim(p_from_program) = '' then raise exception 'from_program requerido'; end if;
  if p_to_program is null or trim(p_to_program) = '' then raise exception 'to_program requerido'; end if;
  if upper(p_from_program) = upper(p_to_program) then raise exception 'Origen y destino no pueden ser iguales'; end if;
  if p_product_id is null then raise exception 'product_id requerido'; end if;
  if p_batch_id is null then raise exception 'batch_id requerido'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity > 0 requerido'; end if;
  if p_observation is null or length(trim(p_observation)) < 5 then raise exception 'Observación mínima 5 caracteres'; end if;

  v_ref := coalesce(nullif(trim(p_ref),''), concat('XFER-', to_char(now(),'YYYYMMDDHH24MISS'), '-', left(gen_random_uuid()::text, 6)));

  select * into b_from from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Lote origen no existe: %', p_batch_id; end if;
  if upper(coalesce(b_from.program_id,'')) <> upper(p_from_program) then
    raise exception 'Lote no pertenece al programa origen (%): lote.program_id=%', p_from_program, b_from.program_id;
  end if;
  if b_from.product_id is distinct from p_product_id then
    raise exception 'Lote no corresponde al producto: lote.product_id=% vs p_product_id=%', b_from.product_id, p_product_id;
  end if;

  if coalesce(b_from.quantity_current,0) < p_quantity then
    raise exception 'Stock insuficiente en lote. Disponible=% solicitado=%', coalesce(b_from.quantity_current,0), p_quantity;
  end if;

  v_exp := b_from.expiry_date;
  v_code := b_from.batch_code;
  v_cost := greatest(coalesce(b_from.input_unit_cost, (select average_cost from public.products where id=p_product_id), 0), 0.01);

  -- Buscar lote destino compatible (mismo batch_code + vencimiento)
  select id into b_to_id
  from public.batches
  where upper(coalesce(program_id,'')) = upper(p_to_program)
    and product_id = p_product_id
    and coalesce(batch_code,'') = coalesce(v_code,'')
    and (expiry_date is not distinct from v_exp)
  limit 1
  for update;

  if b_to_id is null then
    insert into public.batches(
      program_id, product_id, batch_code, expiry_date,
      quantity_initial, quantity_current,
      provider_name, doc_ref, input_unit_cost,
      created_at
    ) values (
      p_to_program, p_product_id, coalesce(v_code, concat('XFER-', left(v_ref, 18))), v_exp,
      0, 0,
      case when v_mode='PRESTAMO' then 'PRESTAMO' else 'TRANSFERENCIA' end,
      v_ref,
      v_cost,
      now()
    ) returning id into b_to_id;
  end if;

  -- Descontar origen / sumar destino
  update public.batches set quantity_current = quantity_current - p_quantity where id = p_batch_id;
  update public.batches set quantity_current = quantity_current + p_quantity where id = b_to_id;

  if v_mode = 'PRESTAMO' then
    v_obs_out := concat('PRESTAMO → ', p_to_program, ' | ', v_ref, ' | ', p_observation);
    v_obs_in  := concat('PRESTAMO ← ', p_from_program, ' | ', v_ref, ' | ', p_observation);
  else
    v_obs_out := concat('TRANSFER → ', p_to_program, ' | ', v_ref, ' | ', p_observation);
    v_obs_in  := concat('TRANSFER ← ', p_from_program, ' | ', v_ref, ' | ', p_observation);
  end if;

  -- Registrar movimientos
  insert into public.movements(type, program_id, product_id, batch_id, quantity, observation, created_at)
  values ('OUT', p_from_program, p_product_id, p_batch_id, p_quantity, v_obs_out, now());

  -- IN requiere: input_unit_cost + provider_name + doc_ref (y batch con expiry)
  insert into public.movements(
    type, program_id, product_id, batch_id, quantity, observation, created_at,
    input_unit_cost, provider_name, doc_ref
  ) values (
    'IN', p_to_program, p_product_id, b_to_id, p_quantity, v_obs_in, now(),
    v_cost,
    case when v_mode='PRESTAMO' then 'PRESTAMO' else 'TRANSFERENCIA' end,
    v_ref
  );

  return jsonb_build_object('status','OK','ref',v_ref,'from_batch',p_batch_id,'to_batch',b_to_id,'qty',p_quantity);
end;
$$;

revoke all on function public.transfer_between_programs(text,text,text,bigint,bigint,numeric,text,text) from public;
grant execute on function public.transfer_between_programs(text,text,text,bigint,bigint,numeric,text,text) to authenticated;

select pg_notify('pgrst','reload schema');
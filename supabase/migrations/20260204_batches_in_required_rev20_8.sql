-- 20260204_batches_in_required_rev20_8.sql
-- REV20.8: Registrar datos obligatorios de ingreso (IN) en batches y validarlos.
-- Idempotente.

-- 1) Columnas adicionales en batches para guardar datos completos del ingreso
alter table if exists public.batches
  add column if not exists provider_name text,
  add column if not exists doc_ref text,
  add column if not exists input_unit_cost numeric(12,3),
  add column if not exists created_by text;

-- 2) Validación: en movimientos tipo IN, asegurar que existan y estén completos los datos de ingreso
create or replace function public.fn_validate_in_required()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  msg text;
begin
  if upper(coalesce(new.type,'')) = 'IN' then
    if new.batch_id is null then
      raise exception 'IN requiere lote (batch_id).';
    end if;

    -- Verificar costo en movimiento
    if new.input_unit_cost is null or new.input_unit_cost <= 0 then
      raise exception 'IN requiere costo unitario (input_unit_cost) > 0.';
    end if;

    -- Verificar nota/observación
    if new.observation is null or length(trim(new.observation)) < 5 then
      raise exception 'IN requiere observación/nota (mínimo 5 caracteres).';
    end if;

    select * into b from public.batches where id = new.batch_id;
    if not found then
      raise exception 'Lote no existe para IN: %', new.batch_id;
    end if;

    if b.batch_code is null or length(trim(b.batch_code)) = 0 then
      raise exception 'IN requiere código de lote (batch_code).';
    end if;

    if b.expiry_date is null then
      raise exception 'IN requiere fecha de vencimiento (expiry_date).';
    end if;

    if b.provider_name is null or length(trim(b.provider_name)) = 0 then
      raise exception 'IN requiere proveedor (provider_name).';
    end if;

    if b.doc_ref is null or length(trim(b.doc_ref)) = 0 then
      raise exception 'IN requiere documento de ingreso (doc_ref).';
    end if;

    if b.input_unit_cost is null or b.input_unit_cost <= 0 then
      raise exception 'IN requiere costo unitario en lote (batches.input_unit_cost) > 0.';
    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_in_required on public.movements;
create trigger trg_validate_in_required
before insert or update on public.movements
for each row
execute function public.fn_validate_in_required();

-- Recargar schema cache PostgREST
select pg_notify('pgrst','reload schema');

-- 20260203_rev20_features.sql
-- REV20: alertas stock/vencimiento, cierre mensual (bloqueo), reversas, tracking last_seen, min_stock.
-- Idempotente.

create extension if not exists pgcrypto;

-- Products: min_stock (umbral para alertas)
alter table if exists public.products
  add column if not exists min_stock numeric(12,3) not null default 0;

-- Profiles: last_seen_at para sesiones/actividad
alter table if exists public.profiles
  add column if not exists last_seen_at timestamptz;

-- Cierres mensuales
create table if not exists public.monthly_closures (
  id bigserial primary key,
  program_id text not null,
  month date not null, -- primer día del mes
  closed_at timestamptz not null default now(),
  closed_by text,
  note text,
  unique(program_id, month)
);

grant select, insert, update, delete on public.monthly_closures to authenticated;

-- is_admin helper (si no existe)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select upper(role)='ADMIN' from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Trigger: bloquear movimientos en meses cerrados (excepto ADMIN con override en observation)
create or replace function public.fn_block_closed_month_movements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_closed boolean;
  v_obs text;
begin
  v_obs := coalesce(new.observation,'');
  v_month := date_trunc('month', coalesce(new.created_at, now()))::date;

  select exists(
    select 1 from public.monthly_closures c
    where c.program_id = new.program_id
      and c.month = v_month
  ) into v_closed;

  if v_closed then
    if public.is_admin() then
      -- ADMIN: requiere override explícito y nota mínima
      if v_obs not ilike 'OVERRIDE_CIERRE:%' or length(trim(v_obs)) < 20 then
        raise exception 'Mes cerrado para % (%). ADMIN requiere OVERRIDE_CIERRE: + nota (>=20 chars).', new.program_id, v_month;
      end if;
    else
      raise exception 'Mes cerrado para % (%). No se permiten cambios.', new.program_id, v_month;
    end if;
  end if;

  return new;
end;
$$;

-- Attach trigger (idempotente)
drop trigger if exists trg_block_closed_month_movements on public.movements;
create trigger trg_block_closed_month_movements
before insert or update on public.movements
for each row
execute function public.fn_block_closed_month_movements();

-- Reversa genérica de un movimiento (IN/OUT/AJUSTE) por ID
-- Nota: asume movements.id UUID (coherente con anular_pecosa.sql)
create or replace function public.revert_movement(p_movement_id uuid, p_justification text, p_user_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  new_type text;
  new_ref text;
  new_id uuid;
begin
  if p_movement_id is null then
    raise exception 'movement_id es obligatorio';
  end if;
  if p_justification is null or length(trim(p_justification)) < 5 then
    raise exception 'Justificación mínima 5 caracteres';
  end if;

  select * into m from public.movements where id = p_movement_id for update;
  if not found then
    raise exception 'Movimiento no existe: %', p_movement_id;
  end if;

  -- Definir tipo inverso
  if upper(coalesce(m.type,'')) = 'IN' then
    new_type := 'OUT';
  elsif upper(coalesce(m.type,'')) = 'OUT' then
    new_type := 'IN';
  else
    -- Si es AJUSTE u otro, invertimos según signo de quantity: si quantity>0, OUT; si quantity<0, IN
    new_type := case when coalesce(m.quantity,0) > 0 then 'OUT' else 'IN' end;
  end if;

  new_ref := concat('REV-', left(p_movement_id::text, 8));

  insert into public.movements(
    id, type, program_id, patient_id, product_id, batch_id, center_id,
    quantity, pecosa_ref, observation, created_at, reversal_of
  ) values (
    gen_random_uuid(),
    new_type,
    m.program_id,
    m.patient_id,
    m.product_id,
    m.batch_id,
    m.center_id,
    abs(coalesce(m.quantity,0)),
    new_ref,
    concat('REVERSA ', p_movement_id::text, ' — ', p_justification),
    now(),
    m.id
  ) returning id into new_id;

  -- Ajuste de stock por lote si aplica
  if m.batch_id is not null then
    if new_type = 'IN' then
      update public.batches set quantity_current = quantity_current + abs(coalesce(m.quantity,0)) where id = m.batch_id;
    else
      update public.batches set quantity_current = quantity_current - abs(coalesce(m.quantity,0)) where id = m.batch_id;
    end if;
  end if;

  return jsonb_build_object('status','OK','reversal_id',new_id,'original_id',m.id,'new_type',new_type);
end;
$$;

revoke all on function public.revert_movement(uuid,text,text) from public;
grant execute on function public.revert_movement(uuid,text,text) to authenticated;

-- KPI: top consumo últimos 30 días
create or replace view public.v_top_consumed_30d as
select program_id, product_id, sum(quantity) as qty_out
from public.movements
where type='OUT' and created_at >= now() - interval '30 days'
group by program_id, product_id;

select pg_notify('pgrst','reload schema');

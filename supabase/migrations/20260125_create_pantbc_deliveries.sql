
-- Entregas PANTBC (MVP)
-- kit_id bigint (kits.id), product_id uuid (products.id)
-- Validación única 1 entrega por paciente por mes/año (solo status <> 'ANULADO')

create table if not exists public.pantbc_deliveries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  kit_id bigint references public.kits(id) on delete set null,
  delivery_date date not null default (now()::date),
  delivery_year int,
  delivery_month int,
  status text not null default 'ENTREGADO',
  justification text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.pantbc_delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.pantbc_deliveries(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  quantity numeric not null default 0
);

-- Backfill year/month
update public.pantbc_deliveries
set delivery_year = extract(year from delivery_date)::int,
    delivery_month = extract(month from delivery_date)::int
where delivery_year is null or delivery_month is null;

-- Trigger year/month
create or replace function public.set_delivery_year_month()
returns trigger language plpgsql as $$
begin
  new.delivery_year := extract(year from new.delivery_date)::int;
  new.delivery_month := extract(month from new.delivery_date)::int;
  return new;
end;
$$;

drop trigger if exists trg_set_delivery_year_month on public.pantbc_deliveries;
create trigger trg_set_delivery_year_month
before insert or update of delivery_date
on public.pantbc_deliveries
for each row execute function public.set_delivery_year_month();

-- Motivo obligatorio si ANULADO
alter table public.pantbc_deliveries
  drop constraint if exists pantbc_deliveries_cancel_requires_justification;

alter table public.pantbc_deliveries
  add constraint pantbc_deliveries_cancel_requires_justification
  check (
    status <> 'ANULADO'
    or (status = 'ANULADO' and coalesce(length(trim(justification)),0) >= 10)
  );

-- Único por paciente + mes/año (solo entregas NO anuladas)
drop index if exists pantbc_deliveries_unique_patient_month;
create unique index pantbc_deliveries_unique_patient_month
  on public.pantbc_deliveries (patient_id, delivery_year, delivery_month)
  where status <> 'ANULADO';

-- Bloquear entrega a paciente INACTIVO
create or replace function public.block_inactive_patients_deliveries()
returns trigger language plpgsql as $$
declare st text;
begin
  select status into st from public.patients where id = new.patient_id;
  if st is distinct from 'ACTIVO' then
    raise exception 'Paciente INACTIVO: no se puede registrar entrega';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_inactive_deliveries on public.pantbc_deliveries;
create trigger trg_block_inactive_deliveries
before insert on public.pantbc_deliveries
for each row execute function public.block_inactive_patients_deliveries();

-- GRANTs
grant usage on schema public to anon, authenticated;
grant select on public.pantbc_deliveries to anon, authenticated;
grant select on public.pantbc_delivery_items to anon, authenticated;
grant insert, update, delete on public.pantbc_deliveries to authenticated;
grant insert, update, delete on public.pantbc_delivery_items to authenticated;

-- RLS
alter table public.pantbc_deliveries enable row level security;
alter table public.pantbc_delivery_items enable row level security;

drop policy if exists pantbc_deliveries_select_auth on public.pantbc_deliveries;
create policy pantbc_deliveries_select_auth on public.pantbc_deliveries
for select using (auth.role() = 'authenticated');

drop policy if exists pantbc_items_select_auth on public.pantbc_delivery_items;
create policy pantbc_items_select_auth on public.pantbc_delivery_items
for select using (auth.role() = 'authenticated');

drop policy if exists pantbc_deliveries_write_roles on public.pantbc_deliveries;
create policy pantbc_deliveries_write_roles on public.pantbc_deliveries
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

drop policy if exists pantbc_items_write_roles on public.pantbc_delivery_items;
create policy pantbc_items_write_roles on public.pantbc_delivery_items
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

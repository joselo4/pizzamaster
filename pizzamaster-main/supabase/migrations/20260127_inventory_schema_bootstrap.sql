
-- 20260127_inventory_schema_bootstrap.sql
-- Bootstrap idempotente para evitar errores por tablas/columnas faltantes y schema cache.
-- Ejecutar en Supabase SQL Editor si aparecen errores como:
--  - Could not find the 'average_cost' column of 'products' in the schema cache
--  - Could not find the table 'public.batches' in the schema cache
--  - Could not find the 'batch_id' column of 'movements' in the schema cache
--  - null value in column "movement_type" violates not-null constraint

-- PRODUCTS
alter table public.products add column if not exists average_cost numeric(12,2) not null default 0;
alter table public.products add column if not exists stock_current numeric(12,2) not null default 0;

-- BATCHES (FEFO)
create table if not exists public.batches (
  id bigserial primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  batch_code text not null,
  expiry_date date null,
  quantity_current numeric(12,2) not null default 0,
  program_id text null,
  created_at timestamptz not null default now()
);
create index if not exists idx_batches_product_id on public.batches(product_id);
create index if not exists idx_batches_expiry_date on public.batches(expiry_date);

-- MOVEMENTS
alter table public.movements add column if not exists batch_id bigint;
alter table public.movements add column if not exists type text;
alter table public.movements add column if not exists movement_type text;

-- FK batch_id -> batches.id
DO $$
begin
  begin
    alter table public.movements
      add constraint movements_batch_id_fk
      foreign key (batch_id) references public.batches(id)
      on delete set null;
  exception when duplicate_object then null;
  end;
end$$;

-- Sync trigger type <-> movement_type
create or replace function public.movements_sync_type()
returns trigger
language plpgsql
as $$
begin
  if (new.movement_type is null or new.movement_type = '') and new.type is not null and new.type <> '' then
    new.movement_type := new.type;
  end if;
  if (new.type is null or new.type = '') and new.movement_type is not null and new.movement_type <> '' then
    new.type := new.movement_type;
  end if;
  if new.type is not null then new.type := upper(new.type); end if;
  if new.movement_type is not null then new.movement_type := upper(new.movement_type); end if;
  return new;
end;
$$;

drop trigger if exists trg_movements_sync_type on public.movements;
create trigger trg_movements_sync_type
before insert or update on public.movements
for each row execute function public.movements_sync_type();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

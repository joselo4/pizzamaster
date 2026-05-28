
-- 20260127_ration_rules_bootstrap_simple.sql
-- Bootstrap SIMPLE e idempotente para Configuración Nutricional (ration_rules)
-- Crea/Agrega sin borrar nada. Evita DO cuando sea posible.

-- 1) Crear tabla si no existe
create table if not exists public.ration_rules (
  id bigserial primary key,
  program_id text not null,
  product_id bigint not null references public.products(id) on delete cascade,
  quantity_per_person_day numeric(12,3) not null default 0,
  updated_at timestamptz not null default now()
);

-- 2) Asegurar columnas (si la tabla existía con otro esquema)
alter table public.ration_rules add column if not exists program_id text;
alter table public.ration_rules add column if not exists product_id bigint;
alter table public.ration_rules add column if not exists quantity_per_person_day numeric(12,3) not null default 0;
alter table public.ration_rules add column if not exists updated_at timestamptz not null default now();

-- 3) Migrar desde nombres antiguos si existieran (se ejecuta solo si las columnas existen)
-- Nota: estas actualizaciones fallarán si la columna no existe, por eso se dejan comentadas.
-- Si tu tabla tenía columna 'quantity' o 'ration', descomenta la que aplique:
-- update public.ration_rules set quantity_per_person_day = coalesce(quantity_per_person_day, quantity);
-- update public.ration_rules set quantity_per_person_day = coalesce(quantity_per_person_day, ration);

-- 4) Unicidad por programa + producto (suficiente para ON CONFLICT (program_id,product_id))
create unique index if not exists ration_rules_uq_program_product
  on public.ration_rules (program_id, product_id);

create index if not exists idx_ration_rules_program on public.ration_rules(program_id);
create index if not exists idx_ration_rules_product on public.ration_rules(product_id);

-- 5) Recargar schema cache PostgREST
NOTIFY pgrst, 'reload schema';

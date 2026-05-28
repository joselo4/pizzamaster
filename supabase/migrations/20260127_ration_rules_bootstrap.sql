
-- 20260127_ration_rules_bootstrap.sql
-- Bootstrap idempotente para Configuración Nutricional (ration_rules)
-- Corrige: columna faltante quantity_per_person_day y unicidad por programa

-- Crear tabla si no existe (mínima)
create table if not exists public.ration_rules (
  id bigserial primary key,
  program_id text not null,
  product_id bigint not null references public.products(id) on delete cascade,
  quantity_per_person_day numeric(12,3) not null default 0,
  updated_at timestamptz not null default now()
);

-- Asegurar columnas
alter table public.ration_rules add column if not exists program_id text;
alter table public.ration_rules add column if not exists product_id bigint;
alter table public.ration_rules add column if not exists quantity_per_person_day numeric(12,3) not null default 0;
alter table public.ration_rules add column if not exists updated_at timestamptz not null default now();

-- Migración desde posibles nombres antiguos (si existen)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ration_rules' AND column_name='quantity'
  ) THEN
    EXECUTE 'update public.ration_rules set quantity_per_person_day = coalesce(quantity_per_person_day, quantity)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ration_rules' AND column_name='ration'
  ) THEN
    EXECUTE 'update public.ration_rules set quantity_per_person_day = coalesce(quantity_per_person_day, ration)';
  END IF;
END
$do$;

-- Unicidad por programa + producto
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ration_rules_program_product_uq'
      AND conrelid = 'public.ration_rules'::regclass
  ) THEN
    ALTER TABLE public.ration_rules
      ADD CONSTRAINT ration_rules_program_product_uq
      UNIQUE (program_id, product_id);
  END IF;
END
$do$;

create index if not exists idx_ration_rules_program on public.ration_rules(program_id);
create index if not exists idx_ration_rules_product on public.ration_rules(product_id);

-- RLS/policies mínimas SOLO si no hay policies
DO $do$
BEGIN
  BEGIN
    ALTER TABLE public.ration_rules ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ration_rules'
  ) THEN
    EXECUTE $$ CREATE POLICY ration_rules_select_auth
              ON public.ration_rules
              FOR SELECT TO authenticated
              USING (true); $$;

    EXECUTE $$ CREATE POLICY ration_rules_write_auth
              ON public.ration_rules
              FOR ALL TO authenticated
              USING (true)
              WITH CHECK (true); $$;
  END IF;

  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.ration_rules TO authenticated;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END
$do$;

-- Recargar schema cache PostgREST
NOTIFY pgrst, 'reload schema';

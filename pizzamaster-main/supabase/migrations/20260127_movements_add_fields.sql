
-- 20260127_movements_add_fields.sql
-- Agrega columnas usadas por la app en public.movements.

alter table public.movements add column if not exists pecosa_ref text;
alter table public.movements add column if not exists observation text;
alter table public.movements add column if not exists patient_id bigint;
alter table public.movements add column if not exists batch_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='movements_patient_id_fkey') THEN
    ALTER TABLE public.movements
      ADD CONSTRAINT movements_patient_id_fkey
      FOREIGN KEY (patient_id)
      REFERENCES public.patients(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='movements_batch_id_fkey') THEN
    ALTER TABLE public.movements
      ADD CONSTRAINT movements_batch_id_fkey
      FOREIGN KEY (batch_id)
      REFERENCES public.batches(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

create index if not exists idx_movements_pecosa_ref on public.movements(pecosa_ref);
create index if not exists idx_movements_patient_id on public.movements(patient_id);
create index if not exists idx_movements_batch_id on public.movements(batch_id);

NOTIFY pgrst, 'reload schema';


-- 20260127_movements_add_center_id.sql
-- Agrega center_id a public.movements para vincular salidas/entradas a un centro.

alter table public.movements
  add column if not exists center_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movements_center_id_fkey') THEN
    ALTER TABLE public.movements
      ADD CONSTRAINT movements_center_id_fkey
      FOREIGN KEY (center_id)
      REFERENCES public.centers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

create index if not exists idx_movements_center_id on public.movements(center_id);

NOTIFY pgrst, 'reload schema';

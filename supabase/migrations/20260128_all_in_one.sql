-- 20260128_all_in_one.sql
-- Ubicación + Identificadores + Vista PECOSA completa (aditivo e idempotente)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS province   text,
  ADD COLUMN IF NOT EXISTS district   text,
  ADD COLUMN IF NOT EXISTS address    text,
  ADD COLUMN IF NOT EXISTS health_center_id bigint,
  ADD COLUMN IF NOT EXISTS dni    text,
  ADD COLUMN IF NOT EXISTS phone  text,
  ADD COLUMN IF NOT EXISTS ubigeo text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_health_center_id_fkey'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_health_center_id_fkey
      FOREIGN KEY (health_center_id)
      REFERENCES public.centers(id)
      ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_patients_health_center_id ON public.patients(health_center_id);
CREATE INDEX IF NOT EXISTS idx_patients_dni            ON public.patients(dni);
CREATE INDEX IF NOT EXISTS idx_patients_ubigeo         ON public.patients(ubigeo);
CREATE OR REPLACE VIEW public.pecosa_export_vw AS
SELECT
  m.id,
  m.created_at,
  m.program_id,
  m.type,
  m.quantity,
  m.pecosa_ref,
  m.observation,
  m.product_id,
  pr.name AS product_name,
  m.center_id            AS destino_center_id,
  dc.name                AS destino_center_name,
  m.patient_id,
  pa.department,
  pa.province,
  pa.district,
  pa.address,
  pa.health_center_id,
  hc.name                AS health_center_name,
  pa.dni,
  pa.phone,
  pa.ubigeo
FROM public.movements m
LEFT JOIN public.products pr ON pr.id = m.product_id
LEFT JOIN public.patients pa ON pa.id = m.patient_id
LEFT JOIN public.centers  hc ON hc.id = pa.health_center_id
LEFT JOIN public.centers  dc ON dc.id = m.center_id;
NOTIFY pgrst, 'reload schema';


-- 20260127_patients_location_and_pecosa_view.sql
-- Aditivo e idempotente. Agrega campos a patients y crea vista para PECOSA enriquecida.

-- 1) Campos de localización y centro de salud en pacientes
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS province   text,
  ADD COLUMN IF NOT EXISTS district   text,
  ADD COLUMN IF NOT EXISTS address    text,
  ADD COLUMN IF NOT EXISTS health_center_id bigint;

-- 2) FK a centers (solo si no existe)
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

-- 3) Índices útiles
CREATE INDEX IF NOT EXISTS idx_patients_health_center_id ON public.patients(health_center_id);

-- 4) Vista de exportación PECOSA (lee movements + patients + centers + products)
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
  hc.name                AS health_center_name
FROM public.movements m
LEFT JOIN public.products pr ON pr.id = m.product_id
LEFT JOIN public.patients pa ON pa.id = m.patient_id
LEFT JOIN public.centers  hc ON hc.id = pa.health_center_id
LEFT JOIN public.centers  dc ON dc.id = m.center_id;

-- 5) (Opcional) RLS de solo lectura para patients (descomentar si la vista no devuelve datos)
-- ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS patients_select_auth ON public.patients;
-- CREATE POLICY patients_select_auth ON public.patients
--   FOR SELECT TO authenticated
--   USING (true);

-- 6) Recargar schema cache
NOTIFY pgrst, 'reload schema';

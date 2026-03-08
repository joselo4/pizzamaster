-- 20260128_patients_identifiers_ubigeo.sql
-- Aditivo: añade DNI, teléfono y UBIGEO a patients; y actualiza vista PECOSA para incluirlos.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS dni    text,
  ADD COLUMN IF NOT EXISTS phone  text,
  ADD COLUMN IF NOT EXISTS ubigeo text;
CREATE INDEX IF NOT EXISTS idx_patients_dni    ON public.patients(dni);
CREATE INDEX IF NOT EXISTS idx_patients_ubigeo ON public.patients(ubigeo);
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

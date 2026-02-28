
REV20.7_STABLE_PATCHED15 – Fix selector + Ajustes impresión visible + Anular PECOSA (expiry_date/input_unit_cost)

Frontend (quirúrgico)
- Sidebar.tsx: <select> usa value={program} (no etiqueta). Evita que se quede fijo en PCA-Comedores.
- PecosaBook.tsx:
  - Corrige JSX inválido (className="...")
  - Ajustes de impresión se muestran como MODAL (overlay) siempre visible.
  - Papel continuo 9.5x11 por defecto (241.3x279.4mm).
  - Preset matricial: Courier Bold, tamaños grandes y líneas gruesas.

Backend (quirúrgico)
- Ejecutar en Supabase SQL Editor:
  pca-main/supabase/migrations/20260204_fix_anular_pecosa_autobatch_required_fields_v2.sql
  (Asegura que la anulación cumpla: batch_id, input_unit_cost>0 y expiry_date).

IMPORTANTE
- Tras ejecutar, refrescar PostgREST: select pg_notify('pgrst','reload schema');

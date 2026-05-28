
REV20.7_STABLE_PATCHED16 – ANULAR PECOSA: provider_name requerido + continuo 9.5x11

Nuevo error resuelto
- Toast: "IN requiere proveedor (provider_name)."

Qué se hizo (quirúrgico)
- Se actualiza public.anular_pecosa para que el IN de reversa y el lote AUTO incluyan:
  - provider_name (AUTO-ANULACION o el del movimiento original)
  - doc_ref (ANULACION-<pecosa_ref> o el del movimiento original)
  - input_unit_cost (>0)
  - expiry_date (current_date + 365)

Acción requerida
1) Reemplaza el proyecto por este ZIP.
2) Ejecuta en Supabase SQL Editor:
   pca-main/supabase/migrations/20260204_fix_anular_pecosa_autobatch_required_fields_v3_provider.sql
3) Reinicia la app.

Impresión
- Papel continuo 9.5x11 sigue por defecto en Ajustes de impresión (modal).

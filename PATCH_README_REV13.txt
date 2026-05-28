REV13 – PCA Subprogramas (Comedores / Hogares y Albergues / Personas en Riesgo) + Resumen Integrador

EJECUTAR EN ORDEN (Supabase → SQL Editor):
 1) pca-main/sql/20260130_pca_subprograms.sql
 2) pca-main/sql/20260130_views_stock_summary.sql

Si el API no refleja cambios:
  select pg_notify('pgrst','reload schema');

Notas:
- program_id es TEXT en products/centers/movements/patients/batches.
- Se oculta el programa histórico 'PCA' en el selector.
- Menú "Resumen" visible para Admin/Operador/Viewer (solo lectura) mediante permiso UI: module:summary.
- Resumen muestra valorización (S/.) y costos (average_cost) para Viewer.

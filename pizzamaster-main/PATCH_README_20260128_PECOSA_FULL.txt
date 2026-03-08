
PATCH – PECOSAS COMPLETO (2026-01-28)
Incluye SQL requeridos y botón de anulación con reversa de stock.
SQL a ejecutar:
  - pca-main/sql/20260128_patients_extra_fields.sql
  - pca-main/sql/20260128_pecosa_book_fix.sql
  - pca-main/sql/20260128_anular_pecosa.sql
Si aparece "schema cache": select pg_notify('pgrst','reload schema');
Luego reiniciar app y validar en Reportes → Libro de PECOSAS (MVP).

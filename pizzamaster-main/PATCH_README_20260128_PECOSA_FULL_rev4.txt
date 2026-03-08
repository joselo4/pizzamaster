
PATCH – PECOSAS COMPLETO (rev4) – 2026-01-28
- Asegura políticas idempotentes (DROP POLICY IF EXISTS + CREATE POLICY)
- Función trigger con delimitador $fn$ para evitar errores de cadena sin cerrar.
- Incluye: patients_extra_fields, pecosa_book_fix, anular_pecosa.

Aplicación (Supabase → SQL Editor):
  1) sql/20260128_patients_extra_fields.sql
  2) sql/20260128_pecosa_book_fix.sql
  3) sql/20260128_anular_pecosa.sql
Si aparece "schema cache": select pg_notify('pgrst','reload schema');

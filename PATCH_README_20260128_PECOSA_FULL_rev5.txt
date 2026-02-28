
PATCH – PECOSAS COMPLETO (rev5) – 2026-01-28
- Incluye los 3 SQL actualizados.
- Asegura columna pecosa_ref aunque la tabla ya exista (ALTER TABLE + UNIQUE INDEX).
- Función trigger con delimitador $fn$ para evitar errores de cadena sin cerrar.
- Integra UI de Libro de PECOSAS con botón ANULAR y justificación obligatoria (PecosaBook.tsx).

Aplicación (Supabase → SQL Editor):
  1) sql/20260128_patients_extra_fields.sql
  2) sql/20260128_pecosa_book_fix.sql
  3) sql/20260128_anular_pecosa.sql
Si aparece "schema cache": select pg_notify('pgrst','reload schema');


PATCH – PECOSAS COMPLETO (rev2) – 2026-01-28

Incluye:
- sql/20260128_patients_extra_fields.sql
- sql/20260128_pecosa_book_fix.sql
- sql/20260128_anular_pecosa.sql
- src/modules/reports/components/PecosaBook.tsx (botón ANULAR con justificación obligatoria)

Aplicación:
1) Supabase → SQL Editor (en orden): a) patients_extra_fields, b) pecosa_book_fix, c) anular_pecosa
2) Si aparece "schema cache": select pg_notify('pgrst','reload schema');
3) Reinicia la app y valida en Reportes → Libro de PECOSAS.

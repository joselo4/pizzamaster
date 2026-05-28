REV15 – Fix Libro PECOSAS + Resumen exportable + Resumen General + Columnas faltantes

EJECUTAR EN ORDEN (Supabase → SQL Editor):
  1) supabase/migrations/20260201_centers_columns_full.sql
  2) supabase/migrations/20260201_patients_autofill_program_id.sql
  3) supabase/migrations/20260201_transactions_pecosa_book_v2.sql
  4) Si el API no refleja cambios: NOTIFY pgrst, 'reload schema';

Frontend:
- Resumen: ahora es exportable a Excel y tiene toggle "Resumen general (todos)".
- Libro PECOSAS: se alimenta desde transactions; el trigger v2 asegura que se registren al emitir salidas (OUT) con pecosa_ref.
- Inventario: muestra errores en toast y agrega campos robustos al crear lotes.
- Pacientes: valida errores reales de Supabase.

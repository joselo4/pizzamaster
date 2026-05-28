
REV9 – Libro de PECOSAS + RPC anular_pecosa (sin romper nada)

Archivos:
1) sql/20260128_pecosa_book_hardening_fix_cast.sql
   - Asegura columnas/índice/rls y backfill (usa comparaciones de TEXTO: program_id::text) + trigger $fn$.
2) sql/20260128_anular_pecosa.sql
   - RPC para anulación con reversa de stock por lote y marca ANULADA en el libro.

Aplicación (Supabase → SQL Editor):
  a) Ejecuta 20260128_pecosa_book_hardening_fix_cast.sql
  b) Ejecuta 20260128_anular_pecosa.sql
  c) Si ves "schema cache": select pg_notify('pgrst','reload schema');

Notas:
- El backfill y el trigger ahora mapean categoría con program_id::text (evita error text=int).
- No se toca ninguna pantalla/flujo existente. El submit de Nuevo Paciente PANTBC ya queda bloqueado si faltan obligatorios (según tu última validación).

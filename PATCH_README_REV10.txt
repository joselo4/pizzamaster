
REV10 – Libro de PECOSAS (safe casts) + RPC anular_pecosa (sin romper nada)

Ejecuta en Supabase → SQL Editor (en orden):
  1) sql/20260128_pecosa_book_hardening_safe_cast_rev10.sql
  2) sql/20260128_anular_pecosa.sql
Si ves "schema cache":
  select pg_notify('pgrst','reload schema');

Qué cambia:
- Se asegura estructura de transactions y políticas RLS (idempotente).
- Backfill/trigger usan program_id::text con regex para evitar casts inválidos y mapean la categoría correctamente (PCA/PANTBC/OLLAS) o NULL si no aplica.
- La RPC anular_pecosa revierte stock por lote y marca la transacción como ANULADA con justificación y traza.

No toca tus pantallas ni el flujo de Nuevo Paciente; si ya tenías la validación de obligatorios, seguirá igual.

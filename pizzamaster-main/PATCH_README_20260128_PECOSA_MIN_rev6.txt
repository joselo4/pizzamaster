
PATCH – Libro de PECOSAS (MIN) – rev6 – 2026-01-28

Este parche SOLO corrige el Libro de PECOSAS para que muestre registros de TODOS los programas y no toca ningún otro módulo (NO toca Nuevo Paciente PANTBC).

Incluye:
- sql/20260128_pecosa_book_fix_MIN.sql  → asegura tabla/columna/index/políticas + backfill + trigger ($fn$)
- src/modules/reports/components/PecosaBook.tsx  → consulta sin filtro por programa (con filtro opcional en UI) y botón ANULAR con justificación

Aplicación:
1) Supabase → SQL Editor: ejecutar sql/20260128_pecosa_book_fix_MIN.sql
   Si aparece "schema cache": select pg_notify('pgrst','reload schema');
2) Reinicia la app y abre Reportes → Libro de PECOSAS (MVP). Verás registros de TODOS los programas (PCA, PANTBC, OLLAS) y puedes anular con justificación.

Nota: No incluye cambios en PANTBC/Nuevo Paciente ni en otros módulos.

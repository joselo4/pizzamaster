REV20.7_STABLE_PATCHED9 – Fix MonthlyClosure closures not defined + incluye pack PECOSAS

Fix (Frontend)
- MonthlyClosure.tsx:
  - Se definió `closures` con useQuery a la tabla `monthly_closures`.
  - Se agregó `closeMonth` (useMutation) para insertar el cierre mensual.
  - Se añadió `useQueryClient` para refrescar el listado tras cerrar.
  - Esto elimina el runtime error: "Uncaught ReferenceError: closures is not defined".

Pack BD incluido (PECOSAS + cierres/alertas)
- Para Cierre mensual/alertas/reversa: ejecutar:
  pca-main/supabase/migrations/20260203_rev20_features.sql

- Para Libro PECOSAS (MVP) y trigger movements->transactions:
  EJECUTAR EN ORDEN (Supabase -> SQL Editor):
    1) pca-main/supabase/migrations/20260201_centers_columns_full.sql
    2) pca-main/supabase/migrations/20260201_patients_autofill_program_id.sql
    3) pca-main/supabase/migrations/20260201_transactions_pecosa_book_v2.sql
    4) Si el API no refleja cambios: select pg_notify('pgrst','reload schema');

Build
  npm install
  npm run dev
  npm run dev:electron


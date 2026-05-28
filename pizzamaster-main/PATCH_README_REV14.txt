REV14 – Fix quirúrgicos de guardado (Centros/Ollas/Pacientes/Entradas)

EJECUTAR EN ORDEN (Supabase → SQL Editor):
  1) supabase/migrations/20260131_centers_add_category.sql
  2) supabase/migrations/20260131_batches_autofill_program_batch_code.sql
  3) (Si el API no refleja cambios) NOTIFY pgrst, 'reload schema';

Cambios Frontend:
- Pacientes PANTBC: ahora valida error de Supabase (insert/update) y muestra error real.
- Inventario/Entradas: agrega validación de cantidad/precio y onError (toast) + incluye program_id y quantity_initial en batches.

Notas:
- Si tu usuario queda en modo lectura, asegúrate de role=ADMIN en public.profiles.

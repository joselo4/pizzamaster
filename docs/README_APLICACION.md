
# Pack de actualización PANTBC (campos de paciente + PECOSA enriquecida)

Este paquete es **aditivo** y **no rompe** comportamientos existentes.

## Contenido
- `supabase/migrations/20260127_patients_location_and_pecosa_view.sql`
  - Añade `department, province, district, address, health_center_id` a `public.patients`.
  - Crea la vista `public.pecosa_export_vw` uniendo `movements + patients + centers + products`.
  - Incluye `NOTIFY pgrst, 'reload schema';`.
- `patches/PatientsManager_add_fields.diff` (guía de edición manual)
- `patches/PecosaBook_view_fallback.diff` (guía de edición manual)
- `src/modules/reports/pecosa_export_types.d.ts` (opcional)

## Cómo aplicar

### 1) Base de datos (Supabase)
1. Copia el contenido de `supabase/migrations/20260127_patients_location_and_pecosa_view.sql` en **SQL Editor** y ejecútalo.
2. Verifica que `pecosa_export_vw` esté creada y que `patients` tenga las columnas nuevas.

> **Importante:** no pegues código TypeScript/React en el SQL Editor. Solo SQL.

### 2) Frontend
1. Abre `src/modules/pantbc/components/PatientsManager.tsx` y aplica los cambios del archivo `patches/PatientsManager_add_fields.diff` (agregar estado, payload e inputs).
2. Abre `src/modules/reports/PecosaBook.tsx` y aplica el patrón de **vista con fallback** (archivo `patches/PecosaBook_view_fallback.diff`).
3. (Opcional) Importa el tipo `PecosaExportRow` para tipar filas cuando la fuente es la vista.

### 3) Probar
- Crear/editar un paciente PANTBC con los nuevos campos.
- Registrar un movimiento **OUT** con `pecosa_ref` asociado.
- En Reportes → PECOSAS, filtrar por fecha y verificar que aparecen: departamento/provincia/distrito/dirección/centro de salud.

Si no se ven columnas de pacientes en la vista por RLS, aplica las líneas comentadas en la migración para **permitir SELECT a authenticated** sobre `public.patients`.


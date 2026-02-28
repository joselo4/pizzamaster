REV20.7_STABLE_PATCHED10 – Nombres completos en UI + Alertas de Inventario corregidas + Fix MonthlyClosure

1) UI: Nombres completos (sin abreviaturas)
- ProgramContext agrega PROGRAM_LABELS y getProgramLabel.
- Se expone programName para usar en UI.
- Sidebar/ProgramLogo/App/Dashboard muestran el nombre amigable.

2) Inventario: ALERTAS
- InventoryCore ahora renderiza correctamente la vista ALERTS (antes caía en Kardex).
- InventoryAlerts muestra tabla "Productos (todos)" con colores por proximidad de vencimiento y luego mantiene detalle por lotes.

3) Cierre mensual
- MonthlyClosure: define closures y closeMonth para evitar crash y permitir cerrar mes.

BD / migraciones
- Para cierres/alertas/reversa: supabase/migrations/20260203_rev20_features.sql
- Para PECOSAS MVP (si aplica): supabase/migrations/20260201_transactions_pecosa_book_v2.sql y reload schema.

Build
 npm install
 npm run dev
 npm run dev:electron

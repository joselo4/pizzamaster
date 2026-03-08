REV20.8 – ALERTAS (todos los programas, FIFO/FEFO) + IN obligatorio + PECOSA con lote

1) Inventario → Stock → ALERTAS
- Se muestra TODOS los lotes con su fecha de vencimiento (sin filtrar por “próximo”).
- Orden FEFO (vence primero) + sugerencia por producto (FEFO/FIFO).
- Colores: ≤120 días (amarillo), ≤90 (naranja), ≤30 (rojo).
- Toggle: Todos los programas / Solo programa activo.

2) Ingreso (IN) obligatorio
- UI: ahora exige costo unitario, proveedor, documento (doc_ref), código de lote, fecha de vencimiento y observación (mín. 5).
- Se guardan proveedor/doc/costo en la tabla batches.

3) PECOSA
- Reimpresión y detalle incluyen columnas LOTE y VENC. (FEFO recomendado si no existe batch_id).

IMPORTANTE – BD
Ejecutar migración en Supabase SQL Editor:
  supabase/migrations/20260204_batches_in_required_rev20_8.sql

Luego:
  npm install
  npm run dev:electron

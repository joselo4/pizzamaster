
REV20.7_STABLE_PATCHED13 – Fix selector programas + PECOSA impresión matricial continuo 9.5x11 + Fix anular sin lote

Frontend (quirúrgico)
- Sidebar.tsx: <select> usa value={program} (no etiqueta) para que cambie correctamente al elegir PCA_COM/PCA_HOG/PCA_RSK.
- PecosaBook.tsx:
  - Se corrige JSX inválido (className="...") que impedía ver 'Ajustes impresión'.
  - Se agrega opción de papel: Continuo 9.5x11 (241.3x279.4mm) y A4.
  - Defaults optimizados para impresora matricial: Courier Bold, tamaños mayores, lineWidth 0.9.

Backend (quirúrgico)
- Supabase migration: 20260204_fix_in_requires_batch_allow_reversal.sql
  Permite movimientos IN sin batch_id SOLO si reversal_of no es null (reversa/anulación). Entradas normales siguen requiriendo lote.

Acciones
1) Reemplazar proyecto por este ZIP.
2) Ejecutar en Supabase SQL Editor: pca-main/supabase/migrations/20260204_fix_in_requires_batch_allow_reversal.sql
3) npm install && npm run dev:electron

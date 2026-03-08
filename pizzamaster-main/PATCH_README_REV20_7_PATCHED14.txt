
REV20.7_STABLE_PATCHED14 – Fix selector PCA + PECOSA continuo 9.5x11 + Fix ANULAR (batch_id)

Frontend (quirúrgico)
- Sidebar.tsx: selector usa value={program} (no etiqueta) => cambia correctamente.
- PecosaBook.tsx: corrige className="..." y agrega papel CONTINUO 9.5x11 (241.3x279.4mm) + defaults matricial.

Backend (quirúrgico)
- Ejecutar en Supabase SQL Editor:
  pca-main/supabase/migrations/20260204_fix_anular_pecosa_autobatch.sql

Este fix crea un lote automático cuando una PECOSA histórica no tenía batch_id,
para que ANULAR no falle y el stock por lote se recupere.

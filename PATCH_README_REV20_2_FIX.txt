REV20.2 – Fix ImportXlsxModal schema (Centers) + Revertir movimiento (Kardex) + Umbral vencimiento configurable

Fixes
- CentersManager: se corrigió el atributo schema={...} de ImportXlsxModal (ahora schema={{...}}).
- PatientsManager: ya venía corregido en REV20.1.

Nuevas mejoras
- Kardex: botón "Revertir movimiento" (solo ADMIN) que llama RPC revert_movement (requiere migración 20260203_rev20_features.sql).
- Alertas: umbral de vencimiento configurable 60/30/15 en UI.

Pasos
1) Supabase SQL Editor: ejecutar pca-main/supabase/migrations/20260203_rev20_features.sql
2) npm install
3) npm run dev:electron

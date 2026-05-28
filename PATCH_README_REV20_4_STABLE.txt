REV20.4_STABLE – Estabilización TSX + Fix SystemHealth

Incluye:
- Fix definitivo: SystemHealth.tsx con un solo nodo raíz (sin JSX adyacente) y imports completos.
- Se mantiene la base REV20.3 con fixes anteriores.

Pasos:
1) (Si no lo hiciste) Ejecutar migración: pca-main/supabase/migrations/20260203_rev20_features.sql
2) npm install
3) npm run dev:electron

Adicional:
- Se normalizó a TSX válido: Sidebar, ProgramLogo, ConnectionIndicator, NoticesBanner, ImportXlsxModal.

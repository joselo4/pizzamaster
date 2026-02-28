REV20.5_STABLE – Fix MonthlyClosure JSX

Fix
- Se corrigió MonthlyClosure.tsx: ahora el return tiene un solo nodo raíz (wrapper <div className="space-y-6">), evitando el error:
  "Adjacent JSX elements must be wrapped".

Incluye todos los fixes de REV20.4_STABLE.

Build
  npm install
  npm run dev:electron

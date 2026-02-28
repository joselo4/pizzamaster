REV20.7_STABLE – Fix AlertTriangle not defined

Fix
- InventoryCore.tsx: se agregó import { AlertTriangle } desde lucide-react.
- KitDelivery.tsx: se agregó import { AlertTriangle } desde lucide-react.

Resultado
- Se elimina error en runtime: "Uncaught ReferenceError: AlertTriangle is not defined".

Build
  npm install
  npm run dev:electron

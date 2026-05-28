REV20.6_STABLE – Fix NoticesPage persist redeclared

Fix
- NoticesPage.tsx: se eliminó la redeclaración de `persist`.
- Ahora existen dos helpers:
  - persistMerge(mutator): merge seguro (lee estado actual y aplica mutación).
  - persistItems(items): wrapper para guardar payload y mostrar toasts.

Resultado
- Compila sin error: "Identifier 'persist' has already been declared".

Build
  npm install
  npm run dev:electron

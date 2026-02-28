REV20.1 – Fix JSX PatientsManager

- Se corrigió error de compilación: "Adjacent JSX elements must be wrapped".
- En PatientsManager, los botones IMPORTAR + NUEVO dentro del mismo condicional ahora están envueltos en un Fragment <>...</>.

Rebuild:
  npm install
  npm run dev
  npm run dev:electron

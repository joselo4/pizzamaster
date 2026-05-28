REV20.3 – Fix StockSummaryPage JSX

Fix
- Se eliminó un </div> extra al final de StockSummaryPage.tsx que causaba:
  "Adjacent JSX elements must be wrapped".

Acción
- Reemplazar proyecto por este ZIP (o copiar el archivo):
  pca-main/src/modules/summary/StockSummaryPage.tsx

Build
  npm install
  npm run dev
  npm run dev:electron

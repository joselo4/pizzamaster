# Instrucciones (Windows) – Sistema PCA/PANTBC (Tailwind OK)

## Problema resuelto
Si aparecía: `Cannot find module 'tailwindcss'` al cargar PostCSS, era porque Tailwind no estaba instalado. En este paquete Tailwind/PostCSS/Autoprefixer están en **dependencies** para que se instalen siempre.

## Requisitos recomendados
- Node.js **20 LTS** (Electron suele ser más estable con LTS que con Node 24).

## Pasos
1) Variables de entorno:
- Copia `.env.example` a `.env.local`
- Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

2) Instalación limpia:
```powershell
cd "C:\Users\HP\Desktop\pca sistema"
rmdir /s /q node_modules 2>$null
del /f /q package-lock.json 2>$null
npm cache verify
npm install
```

3) Ejecutar Electron (DEV):
```powershell
npm run dev:electron
```

Si tu npm está configurado para omitir devDependencies, este paquete igual instala Tailwind porque está en `dependencies`.

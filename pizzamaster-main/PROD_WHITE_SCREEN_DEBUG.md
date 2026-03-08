# Pantalla blanca en Producción

El error `ERR_FILE_NOT_FOUND .../resources/app.asar/dist/index.html` indica que el **build de Vite no fue empaquetado** dentro del instalador.

## Fix aplicado
- electron-builder ahora incluye `dist/**/*` en `build.files`.
- Electron tiene fallback de ruta y logs `did-fail-load`.

## Recompilar
```bash
npm install
npm run dist:electron
```

## Abrir DevTools en producción
```powershell
$env:ELECTRON_DEVTOOLS='1'
& "$env:LOCALAPPDATA\Programs\sistema-pca-pantbc\sistema-pca-pantbc.exe"
```

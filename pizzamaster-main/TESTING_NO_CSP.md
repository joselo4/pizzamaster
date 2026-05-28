# Opción 2 (sin CSP en meta) + Fix de alert/foco

## Qué se cambió
- Se eliminó el `<meta http-equiv="Content-Security-Policy">` del `index.html` (evita pantalla en blanco por bloqueo de scripts al cargar por `file://`).
- Se reemplazó `alert()` por `toast` en guardados clave de Inventario y se agregaron validaciones de error de Supabase.

## Probar en Electron
```bash
npm install
npm run dev:electron
```
- Ir a Inventario → Stock
- Abrir IN o AJUSTAR
- Guardar
- Confirmar que no queda la UI “bloqueada” y que aparecen toasts.

## Build instalador
```bash
npm run dist:electron
```
El instalador saldrá en `release/`.

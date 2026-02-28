# Prueba del Fix: Inputs sin click/teclado después de Guardar (Electron/Render)

## Qué se corrigió
- Se eliminó el uso de `alert()` en guardados (bloquea el hilo UI y puede causar pérdida de foco/click en Electron).
- Se reemplazó por notificaciones no bloqueantes (toast) usando `react-hot-toast`.
- Se añadieron validaciones explícitas de error al guardar en Supabase (`if (error) throw error`) para evitar estados inconsistentes.

## Cómo probar (Electron)
1. Instala dependencias:
   ```bash
   npm install
   ```
2. Ejecuta en modo escritorio:
   ```bash
   npm run dev:electron
   ```
3. Ve a **Inventario / Stock**.
4. Abre **IN** o **AJUSTAR** en cualquier producto.
5. Ingresa datos y pulsa **GUARDAR**.
6. Verifica inmediatamente que:
   - Puedes hacer click en inputs del formulario (incluye los numéricos).
   - Puedes escribir sin que se “congele” el foco.
   - Aparece un toast de confirmación (arriba a la derecha).

## Cómo probar (Web en Render)
1. Ejecuta build local:
   ```bash
   npm run build
   npm run preview
   ```
2. Prueba el mismo flujo que en Electron.

## Verificación adicional
Si algún guardado falla, ahora debe mostrarse un toast con el mensaje de error.

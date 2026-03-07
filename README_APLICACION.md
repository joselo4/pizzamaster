
# README_APLICACION — Integración rápida (Caja → Historial)

## 1) Policy RLS (Supabase)
Ejecuta `04_orders_cashier_update_policy.sql` en el SQL Editor.

## 2) Botón visible en Historial
Si tu componente ocultaba el botón **Editar** por rol, aplica el diff `patches/CashierHistory.showButtonAll.diff` o agrega el botón sin condicionar al rol (usa navigate a `/cashier/history/edit/:id`).

## 3) Ruta y pantalla de edición
Si aún no la agregaste:
```tsx
// App.tsx
import CashierOrderEditor from './pages/CashierOrderEditor';
<Route path="/cashier/history/edit/:id" element={<CashierOrderEditor />} />
```
Y copia `src/pages/CashierOrderEditor.tsx` a tu repo.

## 4) Probar
- Ingresa con un usuario **CASHIER** y con **ADMIN**.
- Abre **Caja → Historial** → **Editar**.
- Cambia **estado** o datos y **Guardar**. Debe persistir.

## 5) Seguridad
- Esta policy deja a `CASHIER` actualizar pedidos. Si necesitas limitar a campos puntuales, usa una RPC `cashier_update_order` con `SECURITY DEFINER` y quita la policy de UPDATE general.

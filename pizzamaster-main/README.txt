
# Patches quirúrgicos (RLS + Tracking + Ticket Validación)

## Contenido
- sql/rls_policies.sql — endurece RLS (config whitelist, orders/order_requests sólo staff)
- sql/tracking_rpc.sql — RPC estricta para tracking por ID o código (sin PII)
- sql/tracking_index.sql — índice único normalizado para tracking_code
- patches/Track.tsx.patch.txt — snippet para usar RPC, ocultar PII y botón "Actualizar"
- patches/Validation.ticket.patch.txt — snippet para botón "Ticket" en Validación

## Orden de aplicación
1. Ejecuta **sql/rls_policies.sql** en Supabase SQL Editor.
2. Ejecuta **sql/tracking_index.sql**.
3. Ejecuta **sql/tracking_rpc.sql**.
4. Aplica los snippets en tu código (`src/pages/Track.tsx` y `src/pages/Validation.tsx`).
5. Prueba:
   - Tracking por **ID** y por **Código** → coincide el pedido correcto.
   - En **/track** no se muestran datos del cliente.
   - Botón **Actualizar** refresca sin recargar.
   - En **Validación**, botón **Ticket** imprime con los mismos parámetros.

## Notas
- Las policies usan `session_role()` (confirmado en tu proyecto). Ajusta el listado de roles si manejas otros.
- Si tu impresor expone otro nombre distinto a `generateTicketPDF`, cambia sólo el import en el snippet de Validación.

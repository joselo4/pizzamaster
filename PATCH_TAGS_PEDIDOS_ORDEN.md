# Patch: ordenar tags de /pedidos

Fecha: 2026-05-03 19:27 UTC

Cambios:
- En `AdminPedidoSettings.tsx` se agregó `pedido_categories` para definir el orden visual de los tags/categorías de `/pedidos`.
- Se puede ordenar con botones **Subir/Bajar** o escribiendo un tag por línea.
- Se corrigió el placeholder JSX usando template literal con `\n`, evitando el error `Unterminated string constant`.
- En `CustomerOrder.tsx` los botones respetan ese orden y agregan al final categorías encontradas en productos que no estén configuradas.
- `Todos` se mantiene automáticamente al final.
- Se agregó `supabase_sql/24_config_public_read_pedido_categories.sql` para RLS.

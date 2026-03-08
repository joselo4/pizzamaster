# Patch quirúrgico – Fix cfg undefined + Branding (2026-03-06)

## Fix
- Se corrigió error `Uncaught ReferenceError: cfg is not defined` en `CustomerOrder.tsx`.
- La barra de marca (`StoreBrandBar`) ya no depende de una variable `cfg` inexistente en `CustomerOrder`.

## Branding
- `StoreBrandBar` se muestra en `/promo`, `/promos`, `/pedido` y `/pedidos`.
- Key: `store_slogan` (editable en AdminPedidoSettings).

## SQL
- `store_slogan` agregado a la policy pública de identidad (si aplica).

## PostgREST
Si no se refleja el cambio de policy:
`select pg_notify('pgrst','reload schema');`

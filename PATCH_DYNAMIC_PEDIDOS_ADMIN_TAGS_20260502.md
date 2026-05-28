# PATCH_DYNAMIC_PEDIDOS_ADMIN_TAGS_20260502

Cambios aplicados:

- `/pedidos` ahora lee los tags/categorías desde `config.pedido_categories` y también incluye categorías detectadas en productos activos.
- Desde Admin → Productos se pueden agregar/ocultar tags visibles en `/pedidos`.
- Los productos nuevos o existentes se pueden asignar a cualquier tag escribiendo la categoría.
- Se puede ocultar/mostrar un producto sin eliminarlo usando el campo `active`.
- El tag `Promo` sigue funcionando con `is_promo`.
- Se mantiene eliminación definitiva con el botón de basurero.
- UX de `/pedidos` mejorada con hero más vendedor, conteo por tag, CTA más fuerte y estado vacío amigable.

Notas:

- No requiere migración nueva si ya existen `products.category`, `products.active`, `products.is_promo` y tabla `config` con `key`/`text_value`.
- Si `pedido_categories` no existe, se crea automáticamente al guardar tags desde Admin.
- Para mostrar un producto en Promo y en su categoría normal, marca “Mostrar también en el tag Promo”.

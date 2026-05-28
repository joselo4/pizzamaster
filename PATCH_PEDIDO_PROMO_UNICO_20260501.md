# PATCH: /pedido con un solo acceso visible a promociones

Se acomodó el diseño para evitar múltiples botones "Promo/Promos" en la misma vista.

Cambios:

- Se dejó un único acceso visible a `/promo`: el CTA grande dentro del bloque principal del pedido.
- Se eliminó el acceso pequeño superior tipo "Promo del día".
- Se eliminó el botón "Promos" del header.
- Se eliminó el botón "Promos" de la barra inferior móvil.
- Se eliminó el acceso "Promos" dentro del carrito/resumen.
- La pestaña de categoría interna `Promo` se muestra como **Ofertas** para no confundirse con el acceso a `/promo`.
- Se mantiene la lógica de productos, carrito, delivery/recojo, tracking y confirmación.
- `/pedido` y `/pedidos` siguen funcionando con el mismo componente.

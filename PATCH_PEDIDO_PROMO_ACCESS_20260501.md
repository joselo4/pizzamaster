# PATCH: Acceso llamativo a /promo desde /pedido

Objetivo: que el cliente identifique rápidamente las promociones y pueda entrar a `/promo` sin perder el flujo de cierre de venta.

Cambios:

- Se mantiene `/pedido` como checkout principal.
- Se mantiene `/pedidos` apuntando al mismo diseño de pedido.
- Se eliminó el bloque visual "Recomendados hoy".
- Se reemplazó el acceso débil a promo por accesos más visibles:
  - Botón compacto **Promos** en el header.
  - CTA grande dentro del hero: **🔥 Ver promociones disponibles**.
  - Acceso rápido **Promos** en la barra inferior móvil.
- Los enlaces usan referencias: `/promo?ref=pedido_header`, `/promo?ref=pedido_cta` y `/promo?ref=pedido_mobile_promo`.
- No se eliminó lógica del carrito, tracking, categorías, delivery/recojo ni confirmación.

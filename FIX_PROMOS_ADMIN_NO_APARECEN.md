# FIX 2 – /promo ahora lee las promos del Admin legacy

## Causa real del problema
En este proyecto, la pestaña **Admin → Promo** guarda la lista de promos en la key de configuración **`promo_promos`** dentro de `config`.  
La versión anterior del parche había cambiado `/promo` para leer primero `promotions`/`products`, por eso las promos configuradas en Admin no aparecían.

## Solución aplicada
`src/pages/Promo.tsx` ahora prioriza este orden:
1. `config.promo_promos` (Admin → Promo legacy)
2. tabla `promotions`
3. tabla `products` con `is_promo=true`

También mantiene:
- contador configurable
- CTA principal a WhatsApp
- promo destacada configurable

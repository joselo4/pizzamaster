# Keys nuevas de config (v5)

Estas mejoras públicas quedaron habilitables/personalizables desde la tabla `config`.

## /promo
- `promo_public_title`
- `promo_public_subtitle`
- `promo_show_catalog` → `true/false`
- `promo_show_summary` → `true/false`
- `promo_show_contact` → `true/false`

## /promos
- `promos_public_title`
- `promos_public_subtitle`

## /pedido
- `pedido_public_title`
- `pedido_public_subtitle`
- `pedido_show_quick_guide` → `true/false`
- `pedido_quick_guide_title`
- `pedido_quick_guide_subtitle`
- `pedido_show_summary_cards` → `true/false`
- `pedido_show_config_help` → `true/false`
- `pedido_default_category`

## Contacto / soporte
- `store_phone`
- `store_wa`
- `telefono_tienda` (fallback)
- `promo_phone` (fallback)
- `promo_wa_number` (fallback)

> Si una key no existe, la app usa defaults seguros y la experiencia sigue funcionando.

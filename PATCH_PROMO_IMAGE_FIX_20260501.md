# PATCH: Imagen de /promo robusta

Problema observado: la imagen configurada desde admin en `/promo` aparecía rota de forma intermitente aunque el enlace existía.

Cambios aplicados:

- Se mantiene la imagen configurada desde admin (`promo_today_image_url`, `image_url` o `thumb_url`).
- Se agregó normalización de URL para espacios y URLs que empiezan con `//`.
- Si la URL de Supabase viene como `object/sign`, se intenta automáticamente una variante `object/public` sin query como respaldo.
- Si una variante falla, el componente intenta la siguiente sin romper la vista.
- Se cambió la imagen principal a `loading="eager"` y `fetchPriority="high"` para evitar carga perezosa en el hero visible.
- Se agregó fallback visual interno en SVG para que nunca aparezca el icono de imagen rota.
- Se mantuvo el diseño de `/pedido` con un solo acceso visible a `/promo`.

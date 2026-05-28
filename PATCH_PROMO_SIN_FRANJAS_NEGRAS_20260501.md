# PATCH: /promo sin franjas negras

Problema: al usar `object-contain` dentro de un marco vertical 3:4, las imágenes horizontales de productos aparecían con franjas negras arriba y abajo.

Solución aplicada:

- El marco principal de imagen de `/promo` pasa de proporción vertical `3:4` a proporción tipo producto `4:3`.
- La imagen cambia a `object-cover` para llenar el marco sin barras negras.
- El fondo del marco cambia a blanco para integrarse mejor con fotos de producto con fondo blanco.
- La vista previa de `/admin > Promo De Hoy` usa el mismo criterio visual para que el administrador vea cómo quedará realmente.
- Se mantiene el componente seguro contra URLs bloqueadas de Facebook/fbcdn y el fallback visual.

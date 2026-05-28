# PATCH: quitar franjas negras en imagen de /promo

La imagen configurada tenía una composición horizontal dentro de un marco vertical, por eso aparecían franjas negras arriba y abajo.

Cambios:

- El marco de imagen de `/promo` y la vista previa de admin cambian de `aspect-[3/4]` a `aspect-[4/3]`.
- Se usa fondo blanco en el marco para fotos de producto.
- Se mantiene `object-cover` para que la imagen llene el espacio.
- Se agregó un zoom suave `scale-[1.18]` para recortar las franjas negras que vienen dentro del propio archivo de imagen.
- No se cambia la lógica de guardado desde admin ni las promociones.

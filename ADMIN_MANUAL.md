# Manual rápido (Admin)

## Promociones (/promo)
1) Entra a **/admin** → pestaña **Promo**.
2) Completa: Código, Título, Precio, Nota, Bullets.
3) (Opcional) pega **URL de imagen** (solo se muestra en **Ver info**).
4) Guardar.

## Prueba rápida
- /promo → Ver info → debe verse detalle + imagen.
- /pedido → confirma que el código llega en la URL.

## Si no se actualiza
- Ctrl+Shift+R
- Console: `localStorage.removeItem('pizza_config_cache_v1'); location.reload();`

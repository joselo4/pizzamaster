# PATCH: Imagen de /promo sin recorte y preview robusto en admin

Problema: la imagen configurada desde admin podía verse rota o incompleta. En la vista pública `/promo`, cuando la imagen cargaba, se recortaba por `object-cover`; en admin la vista previa no tenía el mismo manejo robusto de errores.

Solución aplicada:

- `/promo`: la imagen principal cambia de `object-cover` a `object-contain` para mostrar la imagen completa dentro del marco 3:4.
- `/promo`: se mantiene el cargador robusto con variantes de URL, fallback SVG, `loading="eager"` y `fetchPriority="high"`.
- `/admin` > `Promo De Hoy`: la vista previa ahora usa el mismo enfoque robusto: normaliza URL, prueba variante Supabase `object/public`, agrega cache-busting y usa fallback visual.
- `/admin` > `Promo De Hoy`: la vista previa cambia a `object-contain` para que el administrador vea la imagen completa y no recortada.
- No se altera la configuración guardada desde admin ni la lógica de promociones/pedidos.

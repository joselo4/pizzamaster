# PATCH definitivo: /promo y AdminPromoToday

Este parche corrige dos problemas:

1. Error en admin: `ReferenceError: adminPromoImgIndex is not defined`.
   - Se eliminó la dependencia de variables globales/externas.
   - La carga robusta se encapsuló en `SafePromoImage`, con estado interno propio.

2. Imágenes de Facebook/fbcdn con error 403.
   - Las URLs de Facebook/Instagram/fbcdn no son estables para hotlinking y pueden responder 403 aunque el enlace abra en otra pestaña.
   - El componente ahora detecta esos dominios y evita intentar cargarlos directamente para no mostrar imagen rota ni llenar la consola con 403.
   - En su lugar muestra un fallback visual estable.
   - Para que la imagen real cargue siempre, subir la imagen a Supabase Storage público o a `/public/promos/` y guardar esa URL en Admin.

También se cambió `object-cover` por `object-contain` para mostrar la imagen completa sin recorte.

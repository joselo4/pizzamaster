# PATCH IMAGEN PROMO CORREGIDA

Fecha: 2026-05-01

Corrección aplicada:
- En `/promo`, la imagen principal de "Tu promo de hoy" ahora usa `object-contain`, fondo blanco y padding interno.
- Se cambió el contenedor visual de la imagen a relación `aspect-[4/3]` para evitar recortes en imágenes horizontales de pizzas/productos.
- Se actualizaron vistas públicas relacionadas (`PromoShow`, `PromoPublic`, `PromosPublic`, `PromosLegacy`) para evitar `object-cover` en imágenes de promociones.

Objetivo:
- Evitar que la imagen salga entrecortada o recortada en producción.
- Mostrar completa la imagen subida desde Admin/Supabase Storage.

Archivos modificados:
- pizzamaster-main/pizzamaster-main/src/pages/Promo.tsx
- pizzamaster-main/pizzamaster-main/src/pages/PromoPublic.tsx
- pizzamaster-main/pizzamaster-main/src/pages/PromoShow.tsx
- pizzamaster-main/pizzamaster-main/src/pages/PromosAdmin.tsx
- pizzamaster-main/pizzamaster-main/src/pages/PromosLegacy.tsx
- pizzamaster-main/pizzamaster-main/src/pages/PromosPublic.tsx
- pizzamaster-main/src/pages/Promo.tsx
- pizzamaster-main/src/pages/PromoPublic.tsx
- pizzamaster-main/src/pages/PromoShow.tsx
- pizzamaster-main/src/pages/PromosAdmin.tsx
- pizzamaster-main/src/pages/PromosLegacy.tsx
- pizzamaster-main/src/pages/PromosPublic.tsx

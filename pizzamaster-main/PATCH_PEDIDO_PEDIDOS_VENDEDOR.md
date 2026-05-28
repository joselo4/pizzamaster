# PATCH /PEDIDO Y /PEDIDOS VENDEDOR

Fecha: 2026-05-01

Cambios implementados:
- Se eliminó el bloque "Recomendados hoy" para que ya no aparezca en `/pedido`.
- Se agregó una experiencia más comercial para `/pedidos`:
  - encabezado con copy más vendedor,
  - pasos rápidos de compra,
  - caja de seguimiento más atractiva,
  - banner "Más vendidos para ti",
  - tarjetas con etiquetas de venta y botón "Pedir ahora".
- Se mantuvo la corrección previa de imagen de promo sin recorte.

Archivos modificados:
- pizzamaster-main/pizzamaster-main/src/pages/CustomerOrder.tsx
- pizzamaster-main/pizzamaster-main/src/pages/CustomerOrderLegacy.tsx
- pizzamaster-main/src/pages/CustomerOrder.tsx
- pizzamaster-main/src/pages/CustomerOrderLegacy.tsx

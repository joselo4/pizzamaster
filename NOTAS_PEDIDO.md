# /pedido - costo de envío

- El costo de envío se calcula con la key `pedido_costo_delivery` (también acepta `pedido_delivery_fee`).
- Se permite valor **0** (no se usa `||`).
- Se agrega polling de config cada **1s** como respaldo.
- Se eliminó el texto **Envío** al lado de **Tiempo estimado** (solo queda en el carrito).

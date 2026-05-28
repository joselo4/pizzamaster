# Fix validación – costo de envío

- `/validacion` ahora toma el costo de envío actual desde `config.costo_delivery` y, como fallback legacy, `config.delivery_fee`.
- Se eliminó el valor hardcodeado `3` en `Validation.tsx`.
- Al abrir una solicitud en `/validacion`, el costo mostrado usa el valor actual configurado en `/admin`.
- En `/pedido`, el refresco manual ya no prioriza `pedido_costo_delivery` ni `pedido_delivery_fee`.
- `businessRules.ts` queda unificado para usar solo `costo_delivery` y `delivery_fee`.

# ¿Cómo ver qué key estás cambiando en `config`?

## En Supabase
1) Supabase → **Table Editor**
2) Tabla **config**
3) Columna **key**

En tu proyecto, el módulo AdminPedidoEnvio usa:
- `costo_delivery` (principal)
- `delivery_fee` (fallback)

Por eso /pedido ahora lee esas keys.

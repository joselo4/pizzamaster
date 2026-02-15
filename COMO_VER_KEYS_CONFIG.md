# ¿Cómo ver qué key estás cambiando en `config`?

Tienes 2 formas:

## A) Supabase Dashboard (recomendado)
1. Ve a **Table Editor**
2. Abre la tabla **config**
3. Mira la columna **key** (ahí están los nombres)

Keys relevantes para /pedido:
- `costo_delivery` (la usa el módulo AdminPedidoEnvio)
- `delivery_fee` (fallback)
- `tiempo_estimado_min` / `estimated_minutes`

## B) En el Admin del sistema
En Admin → Pedido → Envío, el costo se guarda en la key `costo_delivery`.

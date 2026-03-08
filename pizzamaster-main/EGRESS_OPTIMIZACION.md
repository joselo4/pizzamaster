# Optimización PostgREST Egress

- /pedido:
  - Config: consulta keys necesarias (IN), cache TTL 60s, polling 60s.
  - Productos: select mínimo + incluye `is_promo` para que el tab Promo funcione.

- /cashier/history:
  - Selector 50/100/150/200; lista liviana (select columnas).
  - select(*) solo al reimprimir.

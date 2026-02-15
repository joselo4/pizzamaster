
# Migraciones (integral)

Ejecuta en Supabase SQL Editor en este orden:

1) 20260215_01_event_log.sql
2) 20260215_02_realtime_config_and_triggers.sql
3) 20260215_03_roles.sql
4) 20260215_04_views_dashboard.sql

Luego prueba:
- /admin/dashboard
- /pedido: cambia config (tiempo_estimado_min, pedido_costo_delivery) y verás actualización inmediata.

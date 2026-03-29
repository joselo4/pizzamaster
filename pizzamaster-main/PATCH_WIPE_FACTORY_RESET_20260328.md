# Patch — Wipe Operativo / Factory Reset estable (2026-03-28)

## Qué corrige
- **Eliminar Datos Operativos (Wipe)** ahora intenta primero un RPC de Supabase con `TRUNCATE ... RESTART IDENTITY CASCADE`.
- Si el RPC aún no está instalado, el frontend usa un **fallback seguro** por API (`delete` con filtros) para no dejar la UI bloqueada.
- Después del wipe se limpian **productos, pedidos, tracking, promociones, clientes, movimientos, lotes, cierres y logs operativos**.
- Se añade limpieza del bucket **`pizza-data`** para eliminar imágenes operativas.
- Se limpian cachés locales del navegador manteniendo la sesión de Supabase.

## Resultado esperado
Después del wipe:
- puedes volver a crear **productos**,
- la numeración de **pedidos** se reinicia si ejecutaste el SQL,
- el flujo de **seguimiento / tracking** queda sin residuos,
- el sistema sigue funcionando con usuarios y permisos preservados.

## Muy importante
Para garantizar reinicio de IDs / números de pedido debes ejecutar el SQL:

- `supabase/migrations/20260328_wipe_operational_data_full.sql`

Luego en SQL Editor:

```sql
select pg_notify('pgrst','reload schema');
```

## Confirmaciones UI
- Restore: `RESTORE-DATOS`
- Wipe: `ELIMINAR-DATOS`

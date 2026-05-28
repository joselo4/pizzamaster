
# Operación — Flags y RLS esenciales

## Flags en `app_settings`
Claves recomendadas (key → value):
- `flag_enable_pecosa_book` → `true|false`
- `flag_enable_fefo_strict` → `true|false`
- `flag_enable_auto_reverse_kardex` → `true|false`
- `flag_enable_backup_schedule` → `true|false`
- `flag_enable_offline_queue` → `true|false`
- `low_stock_threshold_default` → número (ej. `50`)

> Si una clave falta, la app usa un **valor por defecto seguro**.

## RLS esenciales
Ejecutar el script SQL en `supabase/migrations/20260125_rls_essentials.sql` y ajustar si tu esquema difiere. Asume tabla `public.profiles(id uuid, role text)`.

## Cierre mensual (MVP)
El acta usa el **saldo actual** como saldo final. Para arqueo con movimientos, extender cálculo en servidor o vistas materializadas.

## Off-line mínimo
Las inserciones en `movements` y `audit_logs` se encolan en `localStorage` cuando `navigator.onLine == false` y se reintentan al volver la conectividad.

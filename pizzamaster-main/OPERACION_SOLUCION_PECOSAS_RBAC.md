
# Solución: Libro PECOSAS + RBAC por usuario (sin romper)

## Problema 1: "Could not find the table public.transactions in the schema cache"
El Libro ahora auto-detecta la fuente existente:
1) pantbc_deliveries
2) movements
3) transactions
Si ninguna existe, muestra un mensaje claro.

## Problema 2: Admin asigna permisos por usuario
- Migración: supabase/migrations/20260125_user_permissions_rbac.sql
- UI: Configuración → Permisos por usuario (RBAC)

## Compatibilidad
Si no existe la tabla user_permissions o profiles, el sistema NO se rompe:
- usa permisos base por rol (admin/operator/viewer)


# Admin: permisos por usuario (RBAC granular)

## Objetivo
El ADMIN puede autorizar permisos y visibilidad por usuario, sin importar si el rol base es operador o viewer.

## Tabla
- public.user_permissions (user_id, permissions jsonb)

## Cómo funciona
- Si el usuario tiene override en user_permissions.permissions, se aplica.
- Admin siempre tiene acceso total.
- Si no hay override, se usa el rol base (viewer/operator).

## UI
Configuración → "Administración de permisos por usuario"
- Selecciona usuario
- Activa/desactiva permisos por módulo
- Guardado automático

## Seguridad
RLS en user_permissions:
- usuarios ven su fila
- solo ADMIN escribe

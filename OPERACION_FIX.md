
# Correcciones

## 1) Pacientes PANTBC: desactivar con motivación
Ejecutar: supabase/migrations/20260125_patients_inactivation_fields.sql
Luego en Directorios → Pacientes, botón Desactivar, motivo + motivación.

## 2) RBAC por usuario
Ejecutar: supabase/migrations/20260125_user_permissions_rbac.sql
Luego en Configuración (admin) → Permisos por usuario.

## 3) Libro PECOSAS
Auto-detecta tabla: pantbc_deliveries → movements → transactions.

## 4) Error JSX AccessGuard
Este paquete corrige App.tsx con etiquetas cerradas correctamente.

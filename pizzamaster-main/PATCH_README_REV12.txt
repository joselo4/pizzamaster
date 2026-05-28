
REV12 – PECOSA Book (FK-safe) + RPC anular + Pacientes obligatorios + ACL avanzada

EJECUTAR EN ORDEN (Supabase → SQL Editor):
  1) sql/20260128_pecosa_book_hardening_rev12.sql
  2) sql/20260128_anular_pecosa.sql
  3) sql/20260128_patients_required_trigger.sql
  4) sql/20260128_permissions_acl.sql
Si el API no refleja cambios: select pg_notify('pgrst','reload schema');

Detalles clave:
- Mapeo de program_id compatible con FK: resuelve por id o por code/name en tabla programs; si no hay match, usa fn_default_program_id() (mínimo id existente) para no violar FK. La categoría se toma de code/name cuando coincide con PCA/PANTBC/OLLAS; en caso contrario 'OTRO'.
- RPC anular_pecosa: reversa por lote, marca ANULADA con justificación y traza.
- Pacientes PANTBC: agrega columnas y valida cinco obligatorios en INSERT/UPDATE; no toca datos antiguos.
- ACL: lectura para todos; seteo de permisos por master (joseloggc@gmail.com) con RPC set_acl; sin IF NOT EXISTS en CREATE POLICY.

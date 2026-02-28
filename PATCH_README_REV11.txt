
REV11 – PECOSA Book (rev11) + RPC anular + Pacientes obligatorios + ACL avanzada (sin romper nada)

EJECUTAR EN ORDEN (Supabase → SQL Editor):
  1) sql/20260128_pecosa_book_hardening_rev11.sql
  2) sql/20260128_anular_pecosa.sql
  3) sql/20260128_patients_required_trigger.sql
  4) sql/20260128_permissions_acl.sql
Si el API no refleja cambios, ejecutar: select pg_notify('pgrst','reload schema');

DETALLES:
- Libro de PECOSAS: backfill/trigger con mapeo seguro y fallback program_id=1 cuando el origen no es numérico ni PCA/PANTBC/OLLAS (para respetar NOT NULL preexistente sin romper). Mantiene category='OTRO' en ese caso.
- RPC anular_pecosa: reversa por lote + marca ANULADA con justificación y traza.
- Pacientes PANTBC: campos agregados y trigger de validación (Región/Provincia/Distrito/Centro de Salud/Nº Oficio) SOLO en inserción/edición nuevas (no altera datos previos).
- ACL avanzada: tabla app_acl + función is_master + RPC set_acl; lectura para todos, escritura solo master (joseloggc@gmail.com). Permite mostrar/ocultar módulos y controlar ediciones por usuario, sin depender del rol.


PATCH – MIN – rev7 (sin tocar PANTBC/Nuevo Paciente)

Incluye SOLO lo necesario para:
1) Arreglar Libro de PECOSAS (todos los programas):
   - sql/20260128_pecosa_book_hardening.sql (asegura columnas: pecosa_ref, type, category, amount, status, justification, program_id, user_email, meta, created_at; backfill y trigger $fn$).
2) Garantizar columnas de pacientes (sin cambiar UI):
   - sql/20260128_patients_fields_ensure.sql
3) Permisos de master y utilidades:
   - sql/20260128_master_permissions.sql (tabla app_master_users, is_master(), política delete sólo para master y RPC add_master; se incluye jose como master temporal.)
4) PECOSA PANTBC:
   - Ajuste mínimo en KitDelivery.tsx para imprimir Región/Provincia/Distrito/Oficio si existen (no cambia el resto del flujo).

Aplicación:
- Supabase → SQL Editor, ejecutar por orden:
  a) sql/20260128_pecosa_book_hardening.sql
  b) sql/20260128_patients_fields_ensure.sql
  c) sql/20260128_master_permissions.sql
- Si aparece "schema cache": select pg_notify('pgrst','reload schema');
- Reiniciar app y validar Reportes → Libro de PECOSAS.

Este parche NO altera pantallas de Nuevo Paciente PANTBC ni otras UIs, salvo la impresión de PECOSA para mostrar los campos obligatorios si existen.

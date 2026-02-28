REV17 – Unificación quirúrgica (1-4)

1) Permisos
- Se crea core/utils/permissionsUnified.ts como adaptador sobre permissions2 (RBAC + overrides).
- App.tsx deja de depender de core/utils/permissions.ts.

2) Telemetría unificada
- Se crea core/services/telemetry.ts que centraliza error() y audit().
- notifyError() registra errores controlados en public.client_errors.
- errorCapture usa el mismo pipeline.
- AuthContext y ProgramContext inyectan contexto (user_email, program_id).

3) Auditoría
- core/utils/audit.ts queda como wrapper hacia telemetry.audit (compatibilidad).
- Se reemplazan inserciones directas a audit_logs en módulos por telemetry.audit.

4) PECOSA
- logPecosaTransaction se desactiva (NO-OP). Fuente de verdad: trigger en BD (movements -> transactions).

NOTA BD (crítico)
- Si tienes triggers de auditoría en BD, usa función robusta con to_jsonb(NEW/OLD) para evitar errores por columnas inexistentes.

Electron:
  npm install
  npm run dev:electron
  npm run dist:electron

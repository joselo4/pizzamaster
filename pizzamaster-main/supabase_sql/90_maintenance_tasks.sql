-- Base sugerida para automatización operativa (ajusta según tu proyecto).
-- Requiere extensiones/privilegios compatibles con tu instancia.

-- Ejemplo: limpieza semanal de logs pesados.
-- select cron.schedule('cleanup-audit-logs-weekly', '0 3 * * 0', $$
--   delete from public.audit_logs where created_at < now() - interval '90 days';
-- $$);

-- Ejemplo: limpieza de errores cliente.
-- select cron.schedule('cleanup-client-errors-weekly', '15 3 * * 0', $$
--   delete from public.client_errors where created_at < now() - interval '45 days';
-- $$);

-- Ejemplo: snapshot de backups/metadatos.
-- Crea tu tabla de snapshots y reemplaza la lógica por una función propia.

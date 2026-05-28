-- Backup automático a Telegram cada 2 días
-- Requiere: pg_cron + pg_net habilitados.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- (Opcional / recomendado) guardar secretos en Vault
-- select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
-- select vault.create_secret('TU_TG_BACKUP_WEBHOOK_SECRET', 'tg_backup_webhook_secret');

-- Programar job (cada 2 días a las 03:00)
select cron.schedule(
  'telegram-backup-every-2-days',
  '0 3 */2 * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/telegram-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name='tg_backup_webhook_secret')
    ),
    body := jsonb_build_object('run_at', now())
  );
  $$
);

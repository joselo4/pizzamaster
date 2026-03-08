-- 16_event_log_retention.sql
-- Retención: borrar logs antiguos (default 30 días).

create or replace function public.cleanup_event_log(p_days int default 30)
returns void
language plpgsql
as $$
begin
  delete from public.event_log
  where created_at < now() - (p_days || ' days')::interval;
end;
$$;

-- Programar con pg_cron si está disponible (no rompe si no).
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule(
        'cleanup_event_log_daily',
        '0 3 * * *',
        $cmd$select public.cleanup_event_log(30);$cmd$
      );
    exception when others then
      null;
    end;
  end if;
exception when others then
  null;
end
$do$;

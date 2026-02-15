
-- 20260215_02_realtime_config_and_triggers.sql
-- Asegura Realtime para config y log de status en orders

alter table if exists public.config replica identity full;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.config;
  END IF;
END $$;

create or replace function public.trg_orders_status_log()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status then
    perform public.rpc_log_event('info', 'orders.status_change', null, new.id, jsonb_build_object('old', old.status, 'new', new.status));
  end if;
  return new;
end; $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_orders_status_log') THEN
    CREATE TRIGGER trg_orders_status_log
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_orders_status_log();
  END IF;
END $$;

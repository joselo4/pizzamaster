-- 04_realtime_publication.sql
-- Refuerzo: asegura que orders y order_requests estén publicados para Realtime

alter table if exists public.orders replica identity full;
alter table if exists public.order_requests replica identity full;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'order_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_requests;
  END IF;
END $$;

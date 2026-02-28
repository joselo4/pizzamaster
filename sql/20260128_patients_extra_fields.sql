
-- 20260128: Campos adicionales para pacientes PANTBC (sin romper datos existentes)
-- (NULLABLE para no afectar registros antiguos; puedes endurecer luego del backfill)

alter table if exists public.patients add column if not exists region text;
alter table if exists public.patients add column if not exists province text;
alter table if exists public.patients add column if not exists district text;
alter table if exists public.patients add column if not exists health_center text;
alter table if exists public.patients add column if not exists report_officio_number text;
alter table if exists public.patients add column if not exists phone text;
alter table if exists public.patients add column if not exists treatment text;
alter table if exists public.patients add column if not exists notes text;

-- Defaults para nuevas altas
alter table if exists public.patients alter column region set default 'APURÍMAC';
alter table if exists public.patients alter column province set default 'ANDAHUAYLAS';

-- select pg_notify('pgrst','reload schema');

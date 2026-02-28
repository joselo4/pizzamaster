
-- 20260128: Patients fields ensure (no disruptivo)
alter table if exists public.patients add column if not exists region text;
alter table if exists public.patients add column if not exists province text;
alter table if exists public.patients add column if not exists district text;
alter table if exists public.patients add column if not exists health_center text;
alter table if exists public.patients add column if not exists report_officio_number text;
alter table if exists public.patients add column if not exists address text;
alter table if exists public.patients add column if not exists phone text;
alter table if exists public.patients add column if not exists treatment text;
alter table if exists public.patients add column if not exists notes text;
-- Nota: UI/validaciones siguen en frontend. Esto no impone NOT NULL para no romper datos previos.

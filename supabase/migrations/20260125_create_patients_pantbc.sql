
-- Opción B: Crear tabla public.patients (PANTBC) para centralizar y evitar duplicidad
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dni text,
  phone text,
  program_id text default 'PANTBC',
  status text default 'ACTIVO',
  inactive_reason_type text,
  inactive_justification text,
  inactive_at timestamptz,
  inactive_by uuid,
  created_at timestamptz default now()
);

alter table public.patients drop constraint if exists patients_inactive_requires_justification;
alter table public.patients add constraint patients_inactive_requires_justification
check (
  status = 'ACTIVO'
  or (status <> 'ACTIVO' and coalesce(length(trim(inactive_justification)),0) >= 10)
);

-- GRANTs para que PostgREST vea la tabla
grant usage on schema public to anon, authenticated;
grant select on public.patients to anon, authenticated;
grant insert, update, delete on public.patients to authenticated;

-- RLS mínimo
alter table public.patients enable row level security;
drop policy if exists patients_select_auth on public.patients;
create policy patients_select_auth on public.patients
for select using (auth.role() = 'authenticated');

-- Solo admin/operador escribe (requiere public.is_admin_or_operator)
drop policy if exists patients_write_roles on public.patients;
create policy patients_write_roles on public.patients
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

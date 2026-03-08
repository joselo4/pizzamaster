-- Permitir que ADMIN cree perfiles de nuevos usuarios (sin dejar perfiles huérfanos)
-- Requiere función public.is_admin() (ver bootstrap / user_permissions).

-- Grants básicos
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Si profiles tiene RLS activado, estas políticas permiten:
-- - select a usuarios autenticados
-- - insert/update solo a ADMIN o al dueño del perfil
alter table public.profiles enable row level security;

drop policy if exists profiles_select_auth on public.profiles;
create policy profiles_select_auth on public.profiles
for select to authenticated
using (true);

drop policy if exists profiles_insert_admin_or_self on public.profiles;
create policy profiles_insert_admin_or_self on public.profiles
for insert to authenticated
with check (public.is_admin() or auth.uid() = id);

drop policy if exists profiles_update_admin_or_self on public.profiles;
create policy profiles_update_admin_or_self on public.profiles
for update to authenticated
using (public.is_admin() or auth.uid() = id)
with check (public.is_admin() or auth.uid() = id);

-- Recargar schema cache PostgREST
NOTIFY pgrst, 'reload schema';

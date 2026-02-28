
-- FIX: Exponer public.app_users a PostgREST (schema cache) + RLS mínimo
-- Ejecutar en SQL Editor como role postgres.

-- GRANTs
grant usage on schema public to anon, authenticated;
grant select on public.app_users to anon, authenticated;
grant insert, update on public.app_users to authenticated;

-- RLS + policies
alter table public.app_users enable row level security;

drop policy if exists app_users_select_auth on public.app_users;
create policy app_users_select_auth on public.app_users
for select using (auth.role() = 'authenticated');

drop policy if exists app_users_insert_roles on public.app_users;
create policy app_users_insert_roles on public.app_users
for insert with check (public.is_admin_or_operator());

drop policy if exists app_users_update_roles on public.app_users;
create policy app_users_update_roles on public.app_users
for update using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

-- Reload schema cache
select pg_notify('pgrst', 'reload schema');


-- RBAC granular por usuario (Admin asigna permisos por módulo/acción)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select upper(role)='ADMIN' from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.user_permissions (
  user_id uuid primary key,
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.user_permissions enable row level security;

drop policy if exists user_permissions_select_self on public.user_permissions;
create policy user_permissions_select_self on public.user_permissions
for select using (auth.uid()=user_id or public.is_admin());

drop policy if exists user_permissions_admin_write on public.user_permissions;
create policy user_permissions_admin_write on public.user_permissions
for all using (public.is_admin()) with check (public.is_admin());

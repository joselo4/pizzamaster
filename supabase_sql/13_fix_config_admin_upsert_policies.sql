-- 13_fix_config_admin_upsert_policies.sql
alter table if exists public.config enable row level security;
drop policy if exists config_admin_insert on public.config;
create policy config_admin_insert
on public.config
for insert
to public
with check (public.session_role() = 'Admin');
drop policy if exists config_admin_update on public.config;
create policy config_admin_update
on public.config
for update
to public
using (public.session_role() = 'Admin')
with check (public.session_role() = 'Admin');

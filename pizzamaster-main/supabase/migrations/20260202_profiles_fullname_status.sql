-- 20260202_profiles_fullname_status.sql
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists role text,
  add column if not exists status text default 'ACTIVE',
  add column if not exists created_at timestamptz default now();
update public.profiles set role = coalesce(role, 'operator') where role is null;
update public.profiles set status = coalesce(status, 'ACTIVE') where status is null;
select pg_notify('pgrst','reload schema');

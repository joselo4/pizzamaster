
-- Creates client_errors table for UI error telemetry
create table if not exists public.client_errors (
  id bigserial primary key,
  type text,
  message text,
  stack text,
  created_at timestamptz default now()
);
-- enable RLS and allow only admins if you have a role column in profiles
alter table public.client_errors enable row level security;
-- Example policy (adapt to your profiles/roles model)
create policy if not exists client_errors_insert_anon on public.client_errors for insert to anon with check (true);

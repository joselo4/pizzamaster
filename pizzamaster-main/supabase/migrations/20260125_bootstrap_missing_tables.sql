-- Bootstrap seguro (idempotente) para tablas usadas por la App
-- Ejecutar en Supabase SQL Editor si aparecen errores "schema cache" por tablas faltantes.

-- client_errors (telemetría)
create table if not exists public.client_errors (
  id bigserial primary key,
  type text,
  message text,
  stack text,
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;

drop policy if exists client_errors_insert_anon on public.client_errors;
create policy client_errors_insert_anon on public.client_errors for insert to anon with check (true);

drop policy if exists client_errors_select_auth on public.client_errors;
create policy client_errors_select_auth on public.client_errors for select to authenticated using (true);

grant usage on schema public to anon, authenticated;
grant insert on public.client_errors to anon, authenticated;
grant select on public.client_errors to authenticated;

-- audit_logs (auditoría)
create table if not exists public.audit_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  action text not null,
  details text,
  observation text,
  user_email text,
  program_id text
);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_auth on public.audit_logs;
create policy audit_logs_select_auth on public.audit_logs for select to authenticated using (true);

drop policy if exists audit_logs_insert_auth on public.audit_logs;
create policy audit_logs_insert_auth on public.audit_logs for insert to authenticated with check (true);

grant select, insert on public.audit_logs to authenticated;

-- user_permissions (RBAC)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select upper(role)='ADMIN' from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to anon, authenticated;

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

grant select on public.user_permissions to anon, authenticated;
grant insert, update, delete on public.user_permissions to authenticated;

-- transactions (Libro PECOSAS)
create table if not exists public.transactions (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  type text,
  category text,
  amount numeric(12,2),
  status text,
  justification text,
  program_id text,
  user_email text,
  meta jsonb
);

create index if not exists idx_transactions_created_at on public.transactions(created_at desc);

alter table public.transactions enable row level security;

drop policy if exists transactions_select_auth on public.transactions;
create policy transactions_select_auth on public.transactions
for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists transactions_write_auth on public.transactions;
create policy transactions_write_auth on public.transactions
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

grant select on public.transactions to anon, authenticated;
grant insert, update, delete on public.transactions to authenticated;

-- Recargar schema cache PostgREST
NOTIFY pgrst, 'reload schema';

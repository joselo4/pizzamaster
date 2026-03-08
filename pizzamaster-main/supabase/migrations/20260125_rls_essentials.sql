
-- RLS esenciales (lectura universal; escritura por rol)
-- Asume tabla public.profiles con columnas: id (uuid), role (text)
-- Ajusta a tu esquema real si difiere.

-- Helper: función para verificar rol
create or replace function public.has_role(required text)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and upper(p.role) = upper(required)
  );
$$;

-- Helper: admin u operador
create or replace function public.is_admin_or_operator()
returns boolean language sql stable as $$
  select public.has_role('ADMIN') or public.has_role('OPERATOR') or public.has_role('OPERADOR');
$$;

-- PRODUCTS
alter table if exists public.products enable row level security;
-- Lectura a todos los usuarios autenticados (o anon si lo usas)
drop policy if exists products_select_all on public.products;
create policy products_select_all on public.products
for select using (true);
-- Escritura solo admin/operator
drop policy if exists products_write_roles on public.products;
create policy products_write_roles on public.products
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

-- MOVEMENTS (kardex)
alter table if exists public.movements enable row level security;
drop policy if exists movements_select_all on public.movements;
create policy movements_select_all on public.movements for select using (true);
drop policy if exists movements_write_roles on public.movements;
create policy movements_write_roles on public.movements for all
using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

-- APP_SETTINGS (solo admin escribe)
alter table if exists public.app_settings enable row level security;
drop policy if exists app_settings_select_all on public.app_settings;
create policy app_settings_select_all on public.app_settings for select using (true);
drop policy if exists app_settings_write_admin on public.app_settings;
create policy app_settings_write_admin on public.app_settings for all
using (public.has_role('ADMIN')) with check (public.has_role('ADMIN'));

-- KITS
alter table if exists public.kits enable row level security;
create policy if not exists kits_select_all on public.kits for select using (true);
drop policy if exists kits_write_roles on public.kits;
create policy kits_write_roles on public.kits for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

-- KIT_ITEMS
alter table if exists public.kit_items enable row level security;
create policy if not exists kit_items_select_all on public.kit_items for select using (true);
drop policy if exists kit_items_write_roles on public.kit_items;
create policy kit_items_write_roles on public.kit_items for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

-- CENTERS
alter table if exists public.centers enable row level security;
create policy if not exists centers_select_all on public.centers for select using (true);
drop policy if exists centers_write_roles on public.centers;
create policy centers_write_roles on public.centers for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

-- PATIENTS
alter table if exists public.patients enable row level security;
create policy if not exists patients_select_all on public.patients for select using (true);
drop policy if exists patients_write_roles on public.patients;
create policy patients_write_roles on public.patients for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

-- BATCHES (para FEFO)
alter table if exists public.batches enable row level security;
create policy if not exists batches_select_all on public.batches for select using (true);
drop policy if exists batches_write_roles on public.batches;
create policy batches_write_roles on public.batches for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

-- AUDIT_LOGS (lectura general, escritura por el sistema)
alter table if exists public.audit_logs enable row level security;
create policy if not exists audit_logs_select_all on public.audit_logs for select using (true);
drop policy if exists audit_logs_write_any on public.audit_logs;
create policy audit_logs_write_any on public.audit_logs for insert
with check (true);

-- CLIENT_ERRORS (telemetría)
alter table if exists public.client_errors enable row level security;
create policy if not exists client_errors_insert_anon on public.client_errors for insert with check (true);
create policy if not exists client_errors_select_admin on public.client_errors for select using (public.has_role('ADMIN'));

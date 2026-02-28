-- RLS Policies por rol (ADMIN / OPERATOR / VIEWER)
-- Ejecutar en Supabase SQL Editor.

-- Helper: obtener rol actual desde profiles
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select upper(role) from public.profiles where id = auth.uid()), 'VIEWER');
$$;

-- Helper booleans
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'ADMIN';
$$;

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'OPERATOR';
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.centers enable row level security;
alter table public.patients enable row level security;
alter table public.products enable row level security;
alter table public.movements enable row level security;
alter table public.ration_rules enable row level security;
alter table public.kits enable row level security;
alter table public.kit_items enable row level security;
alter table public.batches enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;

-- PROFILES
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
for select using (id = auth.uid() or public.is_admin() or public.is_operator());

drop policy if exists "profiles_write_admin_operator" on public.profiles;
create policy "profiles_write_admin_operator" on public.profiles
for insert with check (public.is_admin() or public.is_operator());

drop policy if exists "profiles_update_admin_operator" on public.profiles;
create policy "profiles_update_admin_operator" on public.profiles
for update using (public.is_admin() or public.is_operator()) with check (public.is_admin() or public.is_operator());

drop policy if exists "profiles_delete_admin_operator" on public.profiles;
create policy "profiles_delete_admin_operator" on public.profiles
for delete using (public.is_admin() or public.is_operator());

-- CENTERS / PATIENTS / PRODUCTS / RULES / KITS / KIT_ITEMS / BATCHES
-- Lectura: cualquier autenticado
-- Escritura: ADMIN u OPERATOR

-- Centers
drop policy if exists "centers_read" on public.centers;
create policy "centers_read" on public.centers
for select using (auth.uid() is not null);

drop policy if exists "centers_write" on public.centers;
create policy "centers_write" on public.centers
for all using (public.is_admin() or public.is_operator())
with check (public.is_admin() or public.is_operator());

-- Patients
drop policy if exists "patients_read" on public.patients;
create policy "patients_read" on public.patients
for select using (auth.uid() is not null);

drop policy if exists "patients_write" on public.patients;
create policy "patients_write" on public.patients
for all using (public.is_admin() or public.is_operator())
with check (public.is_admin() or public.is_operator());

-- Products
drop policy if exists "products_read" on public.products;
create policy "products_read" on public.products
for select using (auth.uid() is not null);

drop policy if exists "products_write" on public.products;
create policy "products_write" on public.products
for all using (public.is_admin() or public.is_operator())
with check (public.is_admin() or public.is_operator());

-- Movements
drop policy if exists "movements_read" on public.movements;
create policy "movements_read" on public.movements
for select using (auth.uid() is not null);

drop policy if exists "movements_write" on public.movements;
create policy "movements_write" on public.movements
for all using (public.is_admin() or public.is_operator())
with check (public.is_admin() or public.is_operator());

-- ration_rules
drop policy if exists "ration_rules_read" on public.ration_rules;
create policy "ration_rules_read" on public.ration_rules
for select using (auth.uid() is not null);

drop policy if exists "ration_rules_write" on public.ration_rules;
create policy "ration_rules_write" on public.ration_rules
for all using (public.is_admin() or public.is_operator())
with check (public.is_admin() or public.is_operator());

-- kits
drop policy if exists "kits_read" on public.kits;
create policy "kits_read" on public.kits
for select using (auth.uid() is not null);

drop policy if exists "kits_write" on public.kits;
create policy "kits_write" on public.kits
for all using (public.is_admin() or public.is_operator())
with check (public.is_admin() or public.is_operator());

-- kit_items
drop policy if exists "kit_items_read" on public.kit_items;
create policy "kit_items_read" on public.kit_items
for select using (auth.uid() is not null);

drop policy if exists "kit_items_write" on public.kit_items;
create policy "kit_items_write" on public.kit_items
for all using (public.is_admin() or public.is_operator())
with check (public.is_admin() or public.is_operator());

-- batches
drop policy if exists "batches_read" on public.batches;
create policy "batches_read" on public.batches
for select using (auth.uid() is not null);

drop policy if exists "batches_write" on public.batches;
create policy "batches_write" on public.batches
for all using (public.is_admin() or public.is_operator())
with check (public.is_admin() or public.is_operator());

-- APP_SETTINGS
-- Lectura para autenticados (necesario para firmas/correlativos/avisos)
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings
for select using (auth.uid() is not null);

-- Escritura ADMIN total
drop policy if exists "app_settings_write_admin" on public.app_settings;
create policy "app_settings_write_admin" on public.app_settings
for all using (public.is_admin()) with check (public.is_admin());

-- Operador: puede actualizar firmas/correlativos pero NO avisos (avisos_*)
drop policy if exists "app_settings_write_operator" on public.app_settings;
create policy "app_settings_write_operator" on public.app_settings
for insert, update
using (public.is_operator() and key not like 'avisos_%')
with check (public.is_operator() and key not like 'avisos_%');

-- AUDIT_LOGS
-- Insert: cualquier autenticado (para registrar acciones)
drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert" on public.audit_logs
for insert with check (auth.uid() is not null);

-- Select: solo ADMIN u OPERATOR (UI de logs)
drop policy if exists "audit_logs_read" on public.audit_logs;
create policy "audit_logs_read" on public.audit_logs
for select using (public.is_admin() or public.is_operator());

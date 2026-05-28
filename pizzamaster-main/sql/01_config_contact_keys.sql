
-- 01_config_contact_keys.sql
-- Claves canónicas para CTA globales y políticas de upsert sólo para ADMIN.

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  );
$$;

-- Policies para que sólo ADMIN inserte/actualice en config
drop policy if exists admin_upsert_config on public.config;
create policy admin_upsert_config on public.config
for insert to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists admin_update_config on public.config;
create policy admin_update_config on public.config
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Asegura claves canónicas y valores por defecto
insert into public.config (key, text_value)
values
  ('store_phone', '+51 900 000 000'),
  ('store_wa',    '+51 900 000 000')
on conflict (key) do update
set text_value = excluded.text_value;

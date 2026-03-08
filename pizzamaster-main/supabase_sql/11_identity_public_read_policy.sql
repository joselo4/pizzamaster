-- 11_identity_public_read_policy.sql
-- Asegura que ANON pueda leer nombre_tienda y logo_url para title/favicon.

alter table if exists public.config enable row level security;

drop policy if exists config_public_read_identity on public.config;
create policy config_public_read_identity
on public.config for select to anon
using (key = any(ARRAY['nombre_tienda','logo_url']));

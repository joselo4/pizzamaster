-- 09_update_config_public_policy.sql
-- Ejecuta SOLO si RLS está habilitado (08_check_rls_config.sql -> rls_enabled=true)

alter table if exists public.config enable row level security;

drop policy if exists config_public_read on public.config;

create policy config_public_read
on public.config
for select
to anon
using (
  key = any (array[
    'nombre_tienda','logo_url',
    'ancho_papel','direccion_tienda','telefono_tienda','footer_ticket',
    'show_logo','show_notes','show_client',
    'facebook','instagram','tiktok','wifi_pass','website','extra_socials',
    'costo_delivery','tiempo_estimado_min'
  ])
);

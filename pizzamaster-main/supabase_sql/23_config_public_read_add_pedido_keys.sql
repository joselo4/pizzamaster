-- 23_config_public_read_add_pedido_keys.sql
-- ✅ QUIRÚRGICO: permite que /pedido (anon) lea SOLO estas keys.

alter table if exists public.config enable row level security;

drop policy if exists config_public_read on public.config;

create policy config_public_read
on public.config
for select
to anon
using (
  key = any (array[
    'nombre_tienda','logo_url','ancho_papel','direccion_tienda','telefono_tienda','footer_ticket',
    'show_logo','show_notes','show_client','facebook','instagram','tiktok','wifi_pass','website','extra_socials',
    'costo_delivery','delivery_fee','tiempo_estimado_min','estimated_minutes',
    'customer_notice_enabled','customer_notice_text',
    'pedido_costo_delivery','pedido_delivery_fee',
    'pedido_default_category'
  ])
);

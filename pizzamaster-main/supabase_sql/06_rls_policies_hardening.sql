
-- 06_rls_policies_hardening.sql
-- RLS hardening using session_role() (exists in your DB)

alter table if exists public.config enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_requests enable row level security;

drop policy if exists config_public_read on public.config;
create policy config_public_read
on public.config for select to anon
using (key = any(ARRAY[
  'nombre_tienda','logo_url','ancho_papel','direccion_tienda','telefono_tienda','footer_ticket',
  'show_logo','show_notes','show_client','facebook','instagram','tiktok','wifi_pass','website','extra_socials'
]));

drop policy if exists config_staff_read on public.config;
create policy config_staff_read
on public.config for select to public
using (public.session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

drop policy if exists orders_staff_select on public.orders;
create policy orders_staff_select
on public.orders for select to public
using (public.session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

drop policy if exists order_requests_staff_select on public.order_requests;
create policy order_requests_staff_select
on public.order_requests for select to public
using (public.session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

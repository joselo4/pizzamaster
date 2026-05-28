
-- RLS hardening (use session_role())
-- Apply safely in order; adjust role list if needed.

-- CONFIG: allow only whitelisted public keys to anon; staff via session_role()
alter table if exists public.config enable row level security;

drop policy if exists config_public_read on public.config;
create policy config_public_read
on public.config for select to anon
using (key = any(ARRAY[
  'nombre_tienda',
  'logo_url',
  'ticket_width_mm',
  'ticket_header',
  'ticket_footer'
]));

drop policy if exists config_staff_read on public.config;
create policy config_staff_read
on public.config for select to public
using (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

-- ORDERS: close to anon; staff can read
alter table if exists public.orders enable row level security;

drop policy if exists orders_staff_select on public.orders;
create policy orders_staff_select
on public.orders for select to public
using (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

-- ORDER_REQUESTS: read only staff (insert should be via RPC already)
alter table if exists public.order_requests enable row level security;

drop policy if exists order_requests_staff_select on public.order_requests;
create policy order_requests_staff_select
on public.order_requests for select to public
using (session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

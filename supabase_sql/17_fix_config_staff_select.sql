-- 17_fix_config_staff_select.sql
alter table if exists public.config enable row level security;
drop policy if exists config_staff_read on public.config;
create policy config_staff_read
on public.config for select to public
using (public.session_role() in ('Admin','Cashier','Kitchen','Delivery','Validation'));

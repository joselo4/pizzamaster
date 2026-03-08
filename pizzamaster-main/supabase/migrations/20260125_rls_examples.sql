
-- EXAMPLE RLS snippets. Adapt to your schema and roles table.
-- products
alter table public.products enable row level security;
-- viewers can read, cannot write
drop policy if exists products_select_all on public.products;
create policy products_select_all on public.products for select using (true);
-- deny writes by default; create specific policies for admin/operator roles in your instance

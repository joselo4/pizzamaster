-- 20260131_centers_add_category.sql
-- Fix: centers.category requerido por el frontend (Centros/Ollas)

alter table if exists public.centers
  add column if not exists category text;

update public.centers
set category = case
  when upper(coalesce(program_id,'')) = 'PANTBC' then 'SALUD'
  when upper(coalesce(program_id,'')) = 'OLLAS'  then 'OLLAS'
  else 'COMEDOR'
end
where category is null;

create index if not exists idx_centers_category on public.centers(category);

-- RLS/policies (idempotente)
alter table public.centers enable row level security;

drop policy if exists centers_select_all on public.centers;
create policy centers_select_all on public.centers
for select to anon, authenticated
using (true);

drop policy if exists centers_write_auth on public.centers;
create policy centers_write_auth on public.centers
for all to authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.centers to anon, authenticated;
grant insert, update, delete on public.centers to authenticated;

NOTIFY pgrst, 'reload schema';

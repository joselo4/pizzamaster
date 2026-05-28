-- 20260201_centers_columns_full.sql
-- Asegura todas las columnas usadas por el frontend en public.centers

alter table if exists public.centers
  add column if not exists code text,
  add column if not exists region text,
  add column if not exists province text,
  add column if not exists district text,
  add column if not exists place text,
  add column if not exists address text,
  add column if not exists president_name text,
  add column if not exists president_dni text,
  add column if not exists president_phone text,
  add column if not exists active_beneficiaries int not null default 0,
  add column if not exists resolution_number text,
  add column if not exists category text;

update public.centers
set category = case
  when upper(coalesce(program_id,'')) = 'PANTBC' then 'SALUD'
  when upper(coalesce(program_id,'')) = 'OLLAS'  then 'OLLAS'
  else 'COMEDOR'
end
where category is null;

update public.centers
set place = coalesce(place, district)
where place is null;

create index if not exists idx_centers_president_dni on public.centers(president_dni);
create index if not exists idx_centers_place on public.centers(place);
create index if not exists idx_centers_category on public.centers(category);

NOTIFY pgrst, 'reload schema';

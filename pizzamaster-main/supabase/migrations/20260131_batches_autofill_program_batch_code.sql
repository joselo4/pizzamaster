-- 20260131_batches_autofill_program_batch_code.sql
-- Fix: IN crea batch primero. Asegura batch_code y programa por defecto.

alter table if exists public.batches
  add column if not exists batch_code text,
  add column if not exists program_id text;

-- Compat: si existía columna code
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='batches' and column_name='code'
  ) then
    execute 'update public.batches set batch_code = coalesce(batch_code, code) where batch_code is null';
  end if;
exception when others then
  null;
end $$;

create or replace function public.fn_batches_autofill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.program_id is null or trim(coalesce(new.program_id,'')) = '' then
    select p.program_id into new.program_id
    from public.products p
    where p.id = new.product_id;
  end if;

  if new.batch_code is null or trim(coalesce(new.batch_code,'')) = '' then
    new.batch_code := 'L-' || extract(year from now())::int;
  end if;

  if new.quantity_initial is null or new.quantity_initial = 0 then
    new.quantity_initial := coalesce(new.quantity_current,0);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_batches_autofill on public.batches;
create trigger trg_batches_autofill
before insert on public.batches
for each row
execute function public.fn_batches_autofill();

create index if not exists idx_batches_batch_code on public.batches(batch_code);
create index if not exists idx_batches_product_batch_code on public.batches(product_id, batch_code);

-- RLS/policies para batches (si no existían)
alter table public.batches enable row level security;

drop policy if exists batches_select_all on public.batches;
create policy batches_select_all on public.batches
for select to anon, authenticated
using (true);

drop policy if exists batches_write_auth on public.batches;
create policy batches_write_auth on public.batches
for all to authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.batches to anon, authenticated;
grant insert, update, delete on public.batches to authenticated;

NOTIFY pgrst, 'reload schema';

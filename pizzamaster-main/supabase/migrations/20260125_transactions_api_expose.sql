
-- Exponer public.transactions a PostgREST (evita "table ... not found in schema cache")
-- 1) Asegurar privilegios
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select on public.transactions to anon;

-- 2) RLS (si está activo, debe haber policy)
alter table public.transactions enable row level security;

drop policy if exists transactions_select_auth on public.transactions;
create policy transactions_select_auth on public.transactions
for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

-- Opcional: solo authenticated escribe
 drop policy if exists transactions_write_auth on public.transactions;
 create policy transactions_write_auth on public.transactions
 for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

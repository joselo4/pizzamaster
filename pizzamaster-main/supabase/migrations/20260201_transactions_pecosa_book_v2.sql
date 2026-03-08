-- 20260201_transactions_pecosa_book_v2.sql
-- Fix: Libro PECOSAS (MVP) vacío -> normaliza transactions y trigger de logging desde movements

create extension if not exists pgcrypto;

-- Asegurar tabla transactions con columnas usadas por la app
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pecosa_ref text,
  type text,
  category text,
  amount numeric(14,2),
  status text,
  justification text,
  program_id text,
  user_email text,
  meta jsonb
);

alter table public.transactions add column if not exists pecosa_ref text;
alter table public.transactions add column if not exists type text;
alter table public.transactions add column if not exists category text;
alter table public.transactions add column if not exists amount numeric(14,2);
alter table public.transactions add column if not exists status text;
alter table public.transactions add column if not exists justification text;
alter table public.transactions add column if not exists program_id text;
alter table public.transactions add column if not exists user_email text;
alter table public.transactions add column if not exists meta jsonb;

-- Defaults
alter table public.transactions alter column type set default 'PECOSA';
alter table public.transactions alter column amount set default 0;
alter table public.transactions alter column status set default 'EMITIDA';

-- Unique por pecosa_ref
create unique index if not exists ux_transactions_pecosa_ref on public.transactions(pecosa_ref);
create index if not exists idx_transactions_created_at on public.transactions(created_at desc);

-- RLS/Policies
alter table public.transactions enable row level security;
drop policy if exists transactions_select_all on public.transactions;
create policy transactions_select_all on public.transactions
for select to authenticated
using (true);

drop policy if exists transactions_write_auth on public.transactions;
create policy transactions_write_auth on public.transactions
for all to authenticated
using (true)
with check (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

-- Trigger function: log de PECOSA al insertar movimientos OUT con pecosa_ref
create or replace function public.fn_log_transaction_from_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(14,2);
  v_prog text;
  v_cat text;
begin
  if new.type = 'OUT' and new.pecosa_ref is not null then
    v_prog := new.program_id;
    v_cat := case
      when upper(v_prog) = 'PANTBC' then 'PANTBC'
      when upper(v_prog) = 'OLLAS' then 'OLLAS'
      when upper(v_prog) like 'PCA_%' then 'PCA'
      else coalesce(upper(v_prog),'OTRO')
    end;

    select coalesce(sum(m.quantity * coalesce(p.average_cost,0)),0)::numeric(14,2)
      into v_amount
    from public.movements m
    join public.products p on p.id = m.product_id
    where m.type='OUT' and m.pecosa_ref = new.pecosa_ref;

    insert into public.transactions (pecosa_ref, type, category, amount, status, justification, program_id, user_email, meta, created_at)
    values (new.pecosa_ref, 'PECOSA', v_cat, v_amount, 'EMITIDA', new.observation, v_prog, null, jsonb_build_object('pecosa', new.pecosa_ref), new.created_at)
    on conflict (pecosa_ref) do update set
      amount = excluded.amount,
      justification = coalesce(excluded.justification, public.transactions.justification),
      program_id = excluded.program_id,
      category = excluded.category,
      created_at = least(public.transactions.created_at, excluded.created_at);
  end if;
  return new;
end;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_movements_to_transactions ON public.movements;
CREATE TRIGGER trg_movements_to_transactions
AFTER INSERT ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_transaction_from_movement();

NOTIFY pgrst, 'reload schema';


-- 20260128: PECOSA Book – Fix MIN (idempotente y no disruptivo)
create extension if not exists pgcrypto;

-- Asegurar tabla y columna clave (sin tocar nada más)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'PECOSA',
  category text,
  amount numeric default 0,
  status text,
  justification text,
  program_id int,
  user_email text,
  meta jsonb,
  created_at timestamptz default now()
);
-- Asegurar pecosa_ref
alter table public.transactions add column if not exists pecosa_ref text;
create unique index if not exists ux_transactions_pecosa_ref on public.transactions(pecosa_ref);

-- RLS + Políticas (idempotente)
alter table public.transactions enable row level security;
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select to authenticated using (true);
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated with check (true);
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions for update to authenticated using (true) with check (true);

-- Backfill (no toca otros objetos)
insert into public.transactions (pecosa_ref, type, category, amount, status, justification, program_id, user_email, meta, created_at)
select
  m.pecosa_ref,
  'PECOSA',
  case m.program_id when 1 then 'PCA' when 2 then 'PANTBC' when 3 then 'OLLAS' else null end,
  coalesce(sum(m.quantity * coalesce(p.average_cost, 0)), 0),
  'EMITIDA',
  substring(string_agg(distinct coalesce(m.observation,''), '; ') for 500),
  m.program_id,
  null,
  jsonb_build_object('pecosa', m.pecosa_ref),
  min(m.created_at)
from public.movements m
join public.products p on p.id = m.product_id
where m.type = 'OUT' and m.pecosa_ref is not null
group by m.program_id, m.pecosa_ref
on conflict (pecosa_ref) do nothing;

-- Trigger (delimitador $fn$ para evitar conflictos del editor)
create or replace function public.fn_log_transaction_from_movement()
returns trigger language plpgsql as $fn$
begin
  if (NEW.type = 'OUT' and NEW.pecosa_ref is not null) then
    insert into public.transactions (
      pecosa_ref, type, category, amount, status, justification, program_id, user_email, meta, created_at
    )
    values (
      NEW.pecosa_ref,
      'PECOSA',
      case NEW.program_id when 1 then 'PCA' when 2 then 'PANTBC' when 3 then 'OLLAS' else null end,
      coalesce((select sum(m.quantity * coalesce(p.average_cost,0)) from public.movements m join public.products p on p.id = m.product_id where m.type='OUT' and m.pecosa_ref = NEW.pecosa_ref), 0),
      'EMITIDA',
      NEW.observation,
      NEW.program_id,
      null,
      jsonb_build_object('pecosa', NEW.pecosa_ref),
      NEW.created_at
    )
    on conflict (pecosa_ref) do update set
      amount        = excluded.amount,
      justification = coalesce(excluded.justification, public.transactions.justification),
      program_id    = excluded.program_id,
      category      = excluded.category,
      created_at    = least(public.transactions.created_at, excluded.created_at);
  end if;
  return NEW;
end
$fn$;

drop trigger if exists trg_movements_to_transactions on public.movements;
create trigger trg_movements_to_transactions after insert on public.movements for each row execute function public.fn_log_transaction_from_movement();

-- select pg_notify('pgrst','reload schema');

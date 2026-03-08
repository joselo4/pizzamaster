
-- 20260128: PECOSA Book – Hardening (safe casts, idempotente, no disruptivo) [rev10]
create extension if not exists pgcrypto;

-- 1) Tabla base mínima (si no existe)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

-- 2) Asegurar columnas requeridas (sin romper existentes)
alter table public.transactions add column if not exists pecosa_ref text;
alter table public.transactions add column if not exists type text;
alter table public.transactions alter column type set default 'PECOSA';
alter table public.transactions add column if not exists category text;
alter table public.transactions add column if not exists amount numeric;
alter table public.transactions alter column amount set default 0;
alter table public.transactions add column if not exists status text;
alter table public.transactions add column if not exists justification text;
alter table public.transactions add column if not exists program_id int;
alter table public.transactions add column if not exists user_email text;
alter table public.transactions add column if not exists meta jsonb;
create unique index if not exists ux_transactions_pecosa_ref on public.transactions(pecosa_ref);

-- 3) RLS + Políticas idempotentes
alter table public.transactions enable row level security;
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select to authenticated using (true);
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated with check (true);
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions for update to authenticated using (true) with check (true);

-- 4) Backfill SEGURO: evita text=int y evita cast inválido
--    * category: si program_id es numérico → PCA/PANTBC/OLLAS; si es texto ('PCA','PANTBC','OLLAS') → usa ese valor en mayúsculas; otro caso → NULL
--    * program_id: sólo se castea a int si es numérico (regex), si no → NULL
insert into public.transactions (
  pecosa_ref, type, category, amount, status, justification, program_id, user_email, meta, created_at
)
select
  m.pecosa_ref,
  'PECOSA' as type,
  case
    when (m.program_id::text ~ '^[0-9]+$') then (
      case (m.program_id::int)
        when 1 then 'PCA'
        when 2 then 'PANTBC'
        when 3 then 'OLLAS'
        else null
      end)
    when upper(m.program_id::text) in ('PCA','PANTBC','OLLAS') then upper(m.program_id::text)
    else null
  end as category,
  coalesce(sum(m.quantity * coalesce(p.average_cost, 0)), 0) as amount,
  'EMITIDA' as status,
  substring(string_agg(distinct coalesce(m.observation,''), '; ') for 500) as justification,
  case when (m.program_id::text ~ '^[0-9]+$') then m.program_id::int else null end as program_id,
  null as user_email,
  jsonb_build_object('pecosa', m.pecosa_ref) as meta,
  min(m.created_at) as created_at
from public.movements m
join public.products p on p.id = m.product_id
where m.type = 'OUT' and m.pecosa_ref is not null
group by m.program_id, m.pecosa_ref
on conflict (pecosa_ref) do nothing;

-- 5) Trigger para salidas futuras ($fn$) con casts seguros
create or replace function public.fn_log_transaction_from_movement()
returns trigger language plpgsql as $fn$
begin
  if (NEW.type = 'OUT' and NEW.pecosa_ref is not null) then
    insert into public.transactions (
      pecosa_ref, type, category, amount, status, justification, program_id, user_email, meta, created_at
    ) values (
      NEW.pecosa_ref,
      'PECOSA',
      case
        when (NEW.program_id::text ~ '^[0-9]+$') then (
          case (NEW.program_id::int)
            when 1 then 'PCA'
            when 2 then 'PANTBC'
            when 3 then 'OLLAS'
            else null
          end)
        when upper(NEW.program_id::text) in ('PCA','PANTBC','OLLAS') then upper(NEW.program_id::text)
        else null
      end,
      coalesce((select sum(m.quantity * coalesce(p.average_cost,0))
                from public.movements m
                join public.products p on p.id = m.product_id
                where m.type='OUT' and m.pecosa_ref = NEW.pecosa_ref), 0),
      'EMITIDA',
      NEW.observation,
      case when (NEW.program_id::text ~ '^[0-9]+$') then NEW.program_id::int else null end,
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

-- Sugerencia si el API no refleja cambios: select pg_notify('pgrst','reload schema');

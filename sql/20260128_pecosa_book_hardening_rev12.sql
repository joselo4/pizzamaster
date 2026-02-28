
-- 20260128: PECOSA Book – Hardening (rev12) – FK-safe mapping using programs table
create extension if not exists pgcrypto;

-- Base table
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

-- Required columns
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

-- RLS + policies (idempotent)
alter table public.transactions enable row level security;
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select to authenticated using (true);
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated with check (true);
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions for update to authenticated using (true) with check (true);

-- Helper: get default programs.id to satisfy FK when source is unknown
create or replace function public.fn_default_program_id()
returns int language sql stable as $$
  select id from public.programs order by id limit 1
$$;

-- Backfill: resolve program_id via programs (by id OR by code/name), else fallback to fn_default_program_id()
insert into public.transactions (
  pecosa_ref, type, category, amount, status, justification, program_id, user_email, meta, created_at
)
select
  m.pecosa_ref,
  'PECOSA' as type,
  upper(coalesce(
    case when (m.program_id::text ~ '^[0-9]+$') then
      case m.program_id::int when 1 then 'PCA' when 2 then 'PANTBC' when 3 then 'OLLAS' else null end
    else null end,
    coalesce(pr_id.code, pr_id.name, pr_key.code, pr_key.name),
    'OTRO'
  )) as category,
  coalesce(sum(m.quantity * coalesce(p.average_cost, 0)), 0) as amount,
  'EMITIDA' as status,
  substring(string_agg(distinct coalesce(m.observation,''), '; ') for 500) as justification,
  coalesce(pr_id.id, pr_key.id, public.fn_default_program_id()) as program_id,
  null as user_email,
  jsonb_build_object('pecosa', m.pecosa_ref) as meta,
  min(m.created_at) as created_at
from public.movements m
join public.products p on p.id = m.product_id
left join public.programs pr_id on ((m.program_id::text ~ '^[0-9]+$') and pr_id.id = m.program_id::int)
left join public.programs pr_key on (not (m.program_id::text ~ '^[0-9]+$') and upper(coalesce(pr_key.code, pr_key.name)) = upper(m.program_id::text))
where m.type = 'OUT' and m.pecosa_ref is not null
group by m.program_id, m.pecosa_ref, pr_id.id, pr_id.code, pr_id.name, pr_key.id, pr_key.code, pr_key.name
on conflict (pecosa_ref) do nothing;

-- Trigger: resolve program and category via programs; FK-safe
create or replace function public.fn_log_transaction_from_movement()
returns trigger language plpgsql as $fn$
declare
  v_cat text;
  v_pid int;
  v_code text;
begin
  if (NEW.type = 'OUT' and NEW.pecosa_ref is not null) then
    -- Try match by numeric id
    if (NEW.program_id::text ~ '^[0-9]+$') then
      select id, upper(coalesce(code,name)) into v_pid, v_code from public.programs where id = NEW.program_id::int limit 1;
    end if;
    -- If not found, try by code/name text
    if v_pid is null then
      select id, upper(coalesce(code,name)) into v_pid, v_code
      from public.programs
      where upper(coalesce(code,name)) = upper(NEW.program_id::text)
      limit 1;
    end if;
    -- Fallback to default program id
    if v_pid is null then
      select public.fn_default_program_id() into v_pid;
      select upper(coalesce(code,name)) into v_code from public.programs where id = v_pid limit 1;
    end if;

    -- Category preferred from program code/name if matches known labels, else derive from numeric mapping, else 'OTRO'
    v_cat := case
      when v_code in ('PCA','PANTBC','OLLAS') then v_code
      when (NEW.program_id::text ~ '^[0-9]+$') then (case NEW.program_id::int when 1 then 'PCA' when 2 then 'PANTBC' when 3 then 'OLLAS' else 'OTRO' end)
      else 'OTRO'
    end;

    insert into public.transactions (
      pecosa_ref, type, category, amount, status, justification, program_id, user_email, meta, created_at
    ) values (
      NEW.pecosa_ref,
      'PECOSA',
      v_cat,
      coalesce((select sum(m.quantity * coalesce(p.average_cost,0))
                from public.movements m
                join public.products p on p.id = m.product_id
                where m.type='OUT' and m.pecosa_ref = NEW.pecosa_ref), 0),
      'EMITIDA',
      NEW.observation,
      v_pid,
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


-- PANTBC: reforzar baja/justificación en app_users y registrar historial

-- 1) Constraint: si is_active=false, inactive_justification mínimo 10 caracteres
alter table public.app_users
  drop constraint if exists app_users_inactive_requires_justification;

alter table public.app_users
  add constraint app_users_inactive_requires_justification
  check (
    is_active = true
    or (is_active = false and coalesce(length(trim(inactive_justification)),0) >= 10)
  );

-- 2) Historial
create table if not exists public.pantbc_user_status_history (
  id bigserial primary key,
  app_user_id uuid not null,
  prev_is_active boolean,
  new_is_active boolean,
  reason_type text,
  justification text,
  changed_at timestamptz default now(),
  changed_by uuid default auth.uid()
);

-- 3) Trigger
create or replace function public.log_pantbc_user_status()
returns trigger language plpgsql as $$
begin
  if new.is_active is distinct from old.is_active then
    insert into public.pantbc_user_status_history(
      app_user_id, prev_is_active, new_is_active, reason_type, justification, changed_by
    ) values (
      new.id, old.is_active, new.is_active, new.inactive_reason_type, new.inactive_justification, auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_pantbc_user_status on public.app_users;
create trigger trg_log_pantbc_user_status
after update on public.app_users
for each row execute function public.log_pantbc_user_status();

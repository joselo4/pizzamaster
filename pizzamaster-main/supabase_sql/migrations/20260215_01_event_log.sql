
-- 20260215_01_event_log.sql
create table if not exists public.event_log (
  id bigserial primary key,
  level text not null default 'info',
  action text not null,
  user_name text,
  order_id bigint,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists event_log_created_idx on public.event_log(created_at desc);
create index if not exists event_log_action_idx on public.event_log(action);

create or replace function public.rpc_log_event(
  p_level text,
  p_action text,
  p_user_name text,
  p_order_id bigint,
  p_meta jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.event_log(level, action, user_name, order_id, meta)
  values (
    coalesce(nullif(p_level,''),'info'),
    left(coalesce(p_action,'unknown'), 120),
    nullif(p_user_name,''),
    p_order_id,
    case when p_meta is null then null else p_meta end
  );
end;
$$;

revoke all on function public.rpc_log_event(text,text,text,bigint,jsonb) from public;
grant execute on function public.rpc_log_event(text,text,text,bigint,jsonb) to anon, authenticated, service_role;


-- 20260128: ACL avanzada (idempotente, sin IF NOT EXISTS en CREATE POLICY)
create table if not exists public.app_master_users(
  email text primary key
);
insert into public.app_master_users(email) values ('joseloggc@gmail.com') on conflict do nothing;

create or replace function public.is_master()
returns boolean language plpgsql stable as $$
declare jwt json; v_email text; begin
  begin select current_setting('request.jwt.claims', true)::json into jwt; v_email := coalesce(jwt->>'email','');
  exception when others then v_email := ''; end;
  return exists (select 1 from public.app_master_users where email = v_email);
end$$;

create table if not exists public.app_acl (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  module text not null,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  created_at timestamptz default now(),
  unique(email, module)
);

alter table public.app_acl enable row level security;
-- lectura: todos autenticados
drop policy if exists app_acl_select on public.app_acl;
create policy app_acl_select on public.app_acl for select to authenticated using (true);
-- escritura: solo master
drop policy if exists app_acl_write on public.app_acl;
create policy app_acl_write on public.app_acl for all to authenticated using (public.is_master()) with check (public.is_master());

-- RPC para setear permisos (solo master)
create or replace function public.set_acl(p_email text, p_module text, p_can_view boolean, p_can_edit boolean)
returns void language plpgsql security definer as $$
begin
  if not public.is_master() then raise exception 'Solo master puede gestionar ACL'; end if;
  insert into public.app_acl(email, module, can_view, can_edit)
  values (lower(p_email), upper(p_module), coalesce(p_can_view,true), coalesce(p_can_edit,false))
  on conflict (email, module)
  do update set can_view = excluded.can_view, can_edit = excluded.can_edit;
end$$;
grant execute on function public.set_acl(text,text,boolean,boolean) to authenticated;

create or replace view public.v_user_acl as
select lower(a.email) as email, upper(a.module) as module, a.can_view, a.can_edit, a.created_at
from public.app_acl a;

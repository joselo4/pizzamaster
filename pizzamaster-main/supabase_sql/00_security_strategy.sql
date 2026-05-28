-- 00_security_strategy.sql (HOTFIX PGCRYPTO)
-- Nota: En Supabase, pgcrypto suele vivir en schema "extensions".
-- Por eso usamos extensions.crypt / extensions.gen_salt / extensions.gen_random_uuid.

-- Asegurar pgcrypto en schema extensions
create extension if not exists pgcrypto with schema extensions;

-- Tablas auxiliares
create table if not exists public.operator_sessions (
  token uuid primary key default extensions.gen_random_uuid(),
  username text not null,
  role text not null,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked boolean not null default false
);
create index if not exists operator_sessions_username_idx on public.operator_sessions(username);
create index if not exists operator_sessions_expires_idx on public.operator_sessions(expires_at);

create table if not exists public.login_attempts (
  id bigserial primary key,
  username text not null,
  ip text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_user_time_idx on public.login_attempts(username, created_at desc);

-- Endurecer users
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='pin_hash'
    ) THEN
      ALTER TABLE public.users ADD COLUMN pin_hash text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='locked_until'
    ) THEN
      ALTER TABLE public.users ADD COLUMN locked_until timestamptz;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='pin'
    ) THEN
      UPDATE public.users
      SET pin_hash = extensions.crypt(trim(pin::text), extensions.gen_salt('bf'))
      WHERE pin_hash IS NULL AND pin IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Header helper
create or replace function public._header(p_name text)
returns text
language plpgsql
stable
as $$
declare
  h jsonb;
  v text;
begin
  begin
    h := current_setting('request.headers', true)::jsonb;
  exception when others then
    return null;
  end;

  if h is null then
    return null;
  end if;

  v := h ->> lower(p_name);
  if v is null then
    v := h ->> p_name;
  end if;

  return nullif(v, '');
end;
$$;

create or replace function public.session_token()
returns uuid
language plpgsql
stable
as $$
declare
  t text;
  u uuid;
begin
  t := public._header('x-session-token');
  if t is null then return null; end if;
  begin
    u := t::uuid;
  exception when others then
    return null;
  end;
  return u;
end;
$$;

create or replace function public.current_session()
returns public.operator_sessions
language sql
stable
as $$
  select *
  from public.operator_sessions s
  where s.token = public.session_token()
    and s.revoked = false
    and now() < s.expires_at
  limit 1;
$$;

create or replace function public.session_valid()
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.current_session());
$$;

create or replace function public.session_role()
returns text
language sql
stable
as $$
  select (public.current_session()).role;
$$;

create or replace function public.session_permissions()
returns text[]
language sql
stable
as $$
  select coalesce((public.current_session()).permissions, '{}');
$$;

create or replace function public.session_has_perm(p_perm text)
returns boolean
language sql
stable
as $$
  select (public.session_role() = 'Admin')
     or (p_perm = any(public.session_permissions()));
$$;

create or replace function public.session_has_any(p_perms text[])
returns boolean
language sql
stable
as $$
  select (public.session_role() = 'Admin')
     or exists (
        select 1
        from unnest(p_perms) x
        where x = any(public.session_permissions())
     );
$$;

-- RPC login (hotfix)
create or replace function public.rpc_login(
  p_username text,
  p_pin text,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
set row_security = off
as $$
declare
  u record;
  fails int;
  lock_mins int := 5;
  window_mins int := 10;
  max_fails int := 5;
  exp timestamptz;
  sess_token uuid;
  norm_user text;
begin
  if p_username is null or p_pin is null then
    return jsonb_build_object('ok', false, 'message', 'Credenciales inválidas');
  end if;

  norm_user := lower(trim(p_username));

  select username, role, permissions, active, pin_hash, locked_until
    into u
  from public.users
  where lower(username) = norm_user
  limit 1;

  -- lazy hash
  if u.username is not null and u.pin_hash is null then
    update public.users
    set pin_hash = extensions.crypt(trim(pin::text), extensions.gen_salt('bf'))
    where lower(username) = norm_user and pin_hash is null and pin is not null;

    select username, role, permissions, active, pin_hash, locked_until
      into u
    from public.users
    where lower(username) = norm_user
    limit 1;
  end if;

  if u.username is null or u.active is not true then
    insert into public.login_attempts(username, ip, success)
    values (norm_user, p_ip, false);
    return jsonb_build_object('ok', false, 'message', 'Usuario o PIN inválido');
  end if;

  if u.locked_until is not null and now() < u.locked_until then
    return jsonb_build_object('ok', false, 'locked', true, 'locked_until', u.locked_until);
  end if;

  if u.pin_hash is null or u.pin_hash <> extensions.crypt(trim(p_pin), u.pin_hash) then
    insert into public.login_attempts(username, ip, success)
    values (norm_user, p_ip, false);

    select count(*) into fails
    from public.login_attempts
    where username = norm_user
      and success = false
      and created_at > now() - make_interval(mins => window_mins);

    if fails >= max_fails then
      update public.users
      set locked_until = now() + make_interval(mins => lock_mins)
      where lower(username) = norm_user;

      return jsonb_build_object(
        'ok', false,
        'locked', true,
        'locked_until', now() + make_interval(mins => lock_mins)
      );
    end if;

    return jsonb_build_object('ok', false, 'message', 'Usuario o PIN inválido');
  end if;

  insert into public.login_attempts(username, ip, success)
  values (norm_user, p_ip, true);

  update public.users set locked_until = null where lower(username) = norm_user;

  exp := now() + interval '30 days';
  sess_token := extensions.gen_random_uuid();

  insert into public.operator_sessions(token, username, role, permissions, expires_at)
  values (sess_token, u.username, u.role, coalesce(u.permissions, '{}'), exp);

  return jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'username', u.username,
      'role', u.role,
      'permissions', coalesce(u.permissions, '{}')
    ),
    'session_token', sess_token::text,
    'expires_at', exp
  );
end;
$$;

revoke all on function public.rpc_login(text, text, text) from public;
grant execute on function public.rpc_login(text, text, text) to anon;

-- Logs
create or replace function public.rpc_log_action(
  p_user_name text,
  p_action text,
  p_details text default ''
)
returns void
language plpgsql
security definer
set search_path = public, extensions
set row_security = off
as $$
declare
  sess public.operator_sessions;
  who text;
begin
  sess := public.current_session();
  if sess.token is null then
    return;
  end if;

  who := sess.username;

  if p_user_name is not null and p_user_name <> who and sess.role <> 'Admin' then
    return;
  end if;

  IF to_regclass('public.system_logs') IS NOT NULL THEN
    insert into public.system_logs(user_name, action, details)
    values (who, p_action, coalesce(p_details,''));
  END IF;
end;
$$;

revoke all on function public.rpc_log_action(text, text, text) from public;
grant execute on function public.rpc_log_action(text, text, text) to anon;

-- Cleanup
create or replace function public.cleanup_operator_sessions()
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  delete from public.operator_sessions
  where revoked = true
     or expires_at < now();

  delete from public.login_attempts
  where created_at < now() - interval '90 days';
end;
$$;

revoke all on function public.cleanup_operator_sessions() from public;

-- Cron opcional (si pg_cron existe). Si falla, crea Scheduled Job manual en Dashboard.
DO $$
BEGIN
  BEGIN
    create extension if not exists pg_cron;
  EXCEPTION WHEN others THEN
    return;
  END;

  BEGIN
    perform cron.schedule('cleanup_operator_sessions_6h', '0 */6 * * *', $cmd$select public.cleanup_operator_sessions();$cmd$);
  EXCEPTION WHEN duplicate_object THEN
    null;
  EXCEPTION WHEN others THEN
    null;
  END;
END $$;

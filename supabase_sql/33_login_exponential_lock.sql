-- PATCH login bloqueo exponencial

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
  lock_step int := 0;
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
      lock_step := greatest(0, fails - max_fails);
      lock_mins := least(240, (5 * power(2, lock_step))::int);
      update public.users
      set locked_until = now() + make_interval(mins => lock_mins)
      where lower(username) = norm_user;
      return jsonb_build_object('ok', false, 'locked', true, 'locked_until', now() + make_interval(mins => lock_mins), 'message', 'Acceso bloqueado por demasiados intentos');
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

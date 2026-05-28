-- soporte opcional para endurecer lockout
create table if not exists public.auth_login_attempts (email text primary key, attempts integer not null default 0, lock_until timestamptz, updated_at timestamptz not null default now());

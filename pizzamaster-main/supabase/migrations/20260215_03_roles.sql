
-- 20260215_03_roles.sql
create table if not exists public.roles (
  id serial primary key,
  code text unique not null,
  name text not null
);

create table if not exists public.user_roles (
  user_id uuid not null,
  role_id int not null references public.roles(id) on delete cascade,
  primary key(user_id, role_id)
);

insert into public.roles(code,name) values
  ('admin','Admin'),
  ('kitchen','Cocina'),
  ('delivery','Delivery'),
  ('cashier','Caja'),
  ('pos','POS'),
  ('marketing','Marketing')
on conflict do nothing;

-- 20A_create_missing_promo_tables.sql
-- Tablas auxiliares del módulo de promos.

create table if not exists public.promotion_codes (
  id bigserial primary key,
  promotion_id bigint not null references public.promotions(id) on delete cascade,
  code text not null,
  single_use boolean not null default false,
  usage_count int not null default 0,
  created_at timestamptz default now()
);

create unique index if not exists promotion_codes_code_uidx
  on public.promotion_codes (upper(trim(code)));

create table if not exists public.promotion_redemptions (
  id bigserial primary key,
  promotion_id bigint not null references public.promotions(id) on delete restrict,
  code_id bigint references public.promotion_codes(id) on delete set null,
  order_id bigint,
  customer_id bigint,
  redeemed_at timestamptz default now()
);

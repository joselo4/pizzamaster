-- 18_promotions_schema.sql
create table if not exists public.promotions (
  id            bigserial primary key,
  slug          text not null unique,
  name          text not null,
  badge         text,
  headline      text,
  subheadline   text,
  body          text,
  price_text    text,
  detail_text   text,
  cta_label     text,
  cta_code      text,
  cta_url       text,
  phone         text,
  wa_number     text,
  wa_message    text,
  image_url     text,
  thumb_url     text,
  active        boolean not null default true,
  starts_at     timestamptz,
  ends_at       timestamptz,
  sort_index    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.trg_promotions_touch() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_promotions_touch on public.promotions;
create trigger trg_promotions_touch
before update on public.promotions
for each row execute procedure public.trg_promotions_touch();

create index if not exists idx_promotions_active_sort on public.promotions (active desc, sort_index asc, created_at desc);

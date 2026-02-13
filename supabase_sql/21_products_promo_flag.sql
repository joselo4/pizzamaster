-- ✅ Patch quirúrgico: bandera de productos para pestaña Promo en /pedido
alter table public.products
  add column if not exists is_promo boolean not null default false;

create index if not exists products_is_promo_idx on public.products (is_promo);

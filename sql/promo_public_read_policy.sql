-- 10_promo_public_read_policy.sql
-- Permite a ANON leer solo keys promo_* necesarias para la landing /promo

alter table if exists public.config enable row level security;

drop policy if exists config_public_read_promo on public.config;
create policy config_public_read_promo
on public.config for select to anon
using (key = any(ARRAY['promo_active', 'promo_badge', 'promo_headline', 'promo_subheadline', 'promo_body', 'promo_price_text', 'promo_detail_text', 'promo_cta_label', 'promo_cta_code', 'promo_phone', 'promo_wa_number', 'promo_wa_message', 'promo_promos']));

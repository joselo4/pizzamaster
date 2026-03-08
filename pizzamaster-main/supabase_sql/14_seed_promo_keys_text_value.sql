-- 14_seed_promo_keys_text_value.sql
insert into public.config (key, text_value)
values
  ('promo_active', 'true'),
  ('promo_badge', 'Publicidad chismosa, promo real.'),
  ('promo_headline', 'Carlos te engaña…'),
  ('promo_subheadline', 'pero con su dieta.'),
  ('promo_body', 'Nuestras pizzas son tan buenas que nadie se resiste. Pide tu promo: pizza personal + chicha por S/10.'),
  ('promo_price_text', 'S/ 10'),
  ('promo_detail_text', 'Pizza personal + botellita de chicha (delivery gratis hoy)'),
  ('promo_cta_label', 'Pedir ahora'),
  ('promo_cta_code', 'CARLOS10'),
  ('promo_phone', '+51989466466'),
  ('promo_wa_number', '51989466466'),
  ('promo_wa_message', 'Hola 👋 Quiero la promo CARLOS (S/10: pizza personal + chicha). ¿Me ayudas a pedir?'),
  ('promo_promos', '')
on conflict (key) do nothing;

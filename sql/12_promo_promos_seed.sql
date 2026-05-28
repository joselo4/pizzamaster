-- 12_promo_promos_seed.sql
-- Upsert key 'promo_promos' con campañas. Incluye "Carlos te engaña…" como primera.

with payload as (
  select jsonb_pretty(
    to_jsonb(
      ARRAY[
        jsonb_build_object(
          'id','carlos','name','Promo Carlos (original)','active', true,'priority', 100,
          'headline','Carlos te engaña…',
          'subheadline','pero con su dieta.',
          'body','Nuestras pizzas son tan buenas que nadie se resiste. Perdona a Carlos y pide tu promo: pizza personal + botellita de chicha por S/10 (delivery gratis hoy).',
          'price_text','S/ 10',
          'detail_text','Pizza personal + botellita de chicha (delivery gratis hoy)',
          'cta_label','Pedir ahora',
          'cta_code','CARLOS10',
          'info_url',null,
          'theme','amber'
        ),
        jsonb_build_object(
          'id','2x1-miercoles','name','2x1 Miércoles','active', true,'priority', 90,
          'headline','Miércoles 2x1 en Pizzas 🍕🍕',
          'subheadline','La segunda es gratis en sabores seleccionados',
          'body','Válido solo los miércoles. No acumulable con otras promos. Stock limitado.',
          'price_text','Desde S/ 39.90','detail_text','Exclusivo delivery',
          'cta_label','Pedir 2x1','cta_code','2X1WED',
          'info_url',null,
          'theme','rose'
        ),
        jsonb_build_object(
          'id','combo-familiar-xxl','name','Combo Familiar XXL','active', true,'priority', 95,
          'headline','Combo Familiar XXL 🍕+🥤',
          'subheadline','3 familiares + 2 bebidas 1.5L',
          'body','Perfecto para 6–8 personas. Incluye 3 sabores a elección.',
          'price_text','S/ 119.90','detail_text','Envío GRATIS en zona',
          'cta_label','Quiero el Combo','cta_code','FAMXXL',
          'info_url',null,
          'theme','indigo'
        )
      ]
    )
  ) as pretty
)
insert into public.config as c (key, text_value)
values ('promo_promos', (select pretty from payload))
on conflict (key) do update set text_value = excluded.text_value;

-- Ejecuta esto para verificar qué orden quedó guardado:
select key, text_value from public.config where key in ('pedido_categories','pedido_tabs','pedido_tags');

-- Para forzar el orden manualmente, edita el JSON y ejecuta:
-- insert into public.config(key, text_value)
-- values ('pedido_categories', '["Promo","Alitas","Bebidas","Pizzas","Extras"]')
-- on conflict (key) do update set text_value = excluded.text_value;

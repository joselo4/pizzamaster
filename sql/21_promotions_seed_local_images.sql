-- 21_promotions_seed_local_images.sql (opcional)
-- Inserta 3 promos editables con imágenes locales (public/promos/*)
-- Cambia +51XXXXXXXXX por tu WhatsApp real antes de ejecutar.

insert into public.promotions (
  slug, name, badge, headline, subheadline, body,
  price_text, detail_text, cta_label, wa_number, wa_message,
  hero_url, channels, status, priority, active, sort_index
)
values
('combo-familiar','Combo Familiar','AHORRA 30%','2 Pizzas + Gaseosa 1.5L','Perfecto para 4 personas','Elige 2 sabores clásicos y acompáñalo con una bebida grande. Ideal para compartir y salir ganando.','S/ 39.90','2 Medianas + Gaseosa 1.5L','Pedir ahora','+51XXXXXXXXX','Hola, quiero el Combo Familiar','/promos/combo-familiar.png','{web,pos}','active',10,true,10),
('martes-2x1','Martes 2x1','SOLO HOY','Pide 1 y llévate otra','Válido en pizzas clásicas','Promoción por tiempo limitado. Aplica al menor precio.','Desde S/ 24.90','Martes 6pm–10pm','Aprovechar 2x1','+51XXXXXXXXX','Hola, quiero el Martes 2x1','/promos/martes-2x1.png','{web,pos}','paused',20,false,20),
('alitas-pizza','Alitas + Pizza','NUEVO','Combo crujiente y contundente','Para compartir entre 2','6 alitas BBQ + 1 pizza mediana a elección.','S/ 34.90','6 alitas + 1 mediana','Quiero esta promo','+51XXXXXXXXX','Hola, quiero Alitas + Pizza','/promos/alitas-pizza.png','{web,pos}','active',30,true,30)
on conflict (slug) do nothing;

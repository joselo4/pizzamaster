-- 20_promotions_seed.sql
-- Seed de promos "vendedoras" (puedes editarlas desde Admin > Promos)
insert into public.promotions (slug,name,badge,headline,subheadline,body,price_text,detail_text,cta_label,cta_code,wa_message,thumb_url,image_url,sort_index,active)
values
('carlos10','Promo Carlos','TOP','¡CARLOS TE ENGAÑA! 💔','...pero tú no te quedas sin cena.','No dejes que te rompan el corazón (ni el estómago). Consuélate con nuestra personal crujiente de 16 cm.','S/ 10','Pizza personal + bebida (hoy)','Pedir mi pizza ahora','CARLOS10','Hola 👋 Quiero la promo CARLOS (S/10). ¿Me ayudas a pedir?','/promos/promo_placeholder_1.svg','/promos/promo_placeholder_2.svg',1,true),
('combo2','Combo 2x Personales','AHORRA','Dos personales, cero drama.','Ideal para compartir (o no).','Dos pizzas personales para resolver la noche: elige sabores y suma bebida.','S/ 24','2 personales (elige sabores)','Quiero el combo','COMBO2','Hola 👋 Quiero el combo 2x personales.','/promos/promo_placeholder_1.svg','/promos/promo_placeholder_2.svg',2,true),
('familiar39','Familiar + Bebida','FAMILIAR','Noche de peli + pizza.','Para 3–4 personas.','Una familiar para la casa: más queso, más amor, más antojo.','S/ 39','Familiar + bebida','Pedir familiar','FAMILIAR39','Hola 👋 Quiero la promo familiar + bebida.','/promos/promo_placeholder_1.svg','/promos/promo_placeholder_2.svg',3,true)
on conflict (slug) do nothing;

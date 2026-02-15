
-- 99_fix_promos_admin_v3_FIXED.sql
-- Arregla error 42601: evita EXECUTE $$...$$ dentro de DO $$...$$.
-- A) /promo: config.promo_promos en formato legacy con imágenes
-- B) /promos y /promo/:slug: public.promotions con image_url/thumb_url (si existe)

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotions'
  ) THEN
    INSERT INTO public.promotions
      (slug,name,badge,headline,subheadline,price_text,detail_text,cta_label,cta_code,wa_message,image_url,thumb_url,active,starts_at,ends_at,sort_index)
    VALUES
      ('2x1-hawaiana','2x1 Hawaiana','2x1','Paga 1 y llévate 2','Jamón + piña','S/ 0.00','2 pizzas (mismo tamaño)','Pedir ahora','2X1HAW','Hola 👋 Quiero la promo 2x1 Hawaiana.','/promos/2x1_hawaiana_banner.svg','/promos/2x1_hawaiana_square.svg',true,NULL,NULL,10),
      ('2x1-pepperoni','2x1 Pepperoni','2x1','Paga 1 y llévate 2','Pepperoni + queso','S/ 0.00','2 pizzas (mismo tamaño)','Pedir ahora','2X1PEP','Hola 👋 Quiero la promo 2x1 Pepperoni.','/promos/2x1_pepperoni_banner.svg','/promos/2x1_pepperoni_square.svg',true,NULL,NULL,11),
      ('2x1-americana','2x1 Americana','2x1','Paga 1 y llévate 2','Jamón + queso','S/ 0.00','2 pizzas (mismo tamaño)','Pedir ahora','2X1AME','Hola 👋 Quiero la promo 2x1 Americana.','/promos/2x1_americana_banner.svg','/promos/2x1_americana_square.svg',true,NULL,NULL,12),
      ('combo-familiar','Combo Familiar','TOP','2 medianas + 1.5L','Ideal para 4','S/ 0.00','2 pizzas medianas + bebida','Comprar combo','FAM','Hola 👋 Quiero el Combo Familiar.','/promos/combo_familiar_landscape.svg','/promos/combo_familiar_square.svg',true,NULL,NULL,2)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      badge = EXCLUDED.badge,
      headline = EXCLUDED.headline,
      subheadline = EXCLUDED.subheadline,
      price_text = EXCLUDED.price_text,
      detail_text = EXCLUDED.detail_text,
      cta_label = EXCLUDED.cta_label,
      cta_code = EXCLUDED.cta_code,
      wa_message = EXCLUDED.wa_message,
      image_url = EXCLUDED.image_url,
      thumb_url = EXCLUDED.thumb_url,
      active = TRUE,
      starts_at = NULL,
      ends_at = NULL,
      sort_index = EXCLUDED.sort_index;
  END IF;
END
$do$;

DO $do$
DECLARE
  v_json TEXT := '[{"tag":"2x1","title":"2x1 Hawaiana","price":"S/ 0.00","note":"Jamón + piña (mismo tamaño)","promo":"2X1HAW","bullets":["Paga 1 y llévate 2","Válido hoy","Delivery según zona"],"image":"/promos/2x1_hawaiana_banner.svg","info_url":"/promo/2x1-hawaiana"},
               {"tag":"2x1","title":"2x1 Pepperoni","price":"S/ 0.00","note":"Pepperoni + queso (mismo tamaño)","promo":"2X1PEP","bullets":["Paga 1 y llévate 2","Válido hoy","Cupos limitados"],"image":"/promos/2x1_pepperoni_banner.svg","info_url":"/promo/2x1-pepperoni"},
               {"tag":"2x1","title":"2x1 Americana","price":"S/ 0.00","note":"Jamón + queso (mismo tamaño)","promo":"2X1AME","bullets":["Paga 1 y llévate 2","Válido hoy","Ideal para compartir"],"image":"/promos/2x1_americana_banner.svg","info_url":"/promo/2x1-americana"},
               {"tag":"FAMILIAR","title":"Combo Familiar","price":"S/ 0.00","note":"2 medianas + bebida 1.5L","promo":"FAM","bullets":["Ideal para 4","Masa fina + queso full","Ahorro real"],"image":"/promos/combo_familiar_landscape.svg","info_url":"/promo/combo-familiar"}]';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'config'
  ) THEN
    BEGIN
      -- Variante A: config(key, value)
      INSERT INTO public.config AS c (key, value)
      VALUES ('promo_active', 'true')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

      INSERT INTO public.config AS c (key, value)
      VALUES ('promo_promos', v_json)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

    EXCEPTION WHEN undefined_column THEN
      -- Variante B: config(key, text_value)
      INSERT INTO public.config AS c (key, text_value)
      VALUES ('promo_active', 'true')
      ON CONFLICT (key) DO UPDATE SET text_value = EXCLUDED.text_value;

      INSERT INTO public.config AS c (key, text_value)
      VALUES ('promo_promos', v_json)
      ON CONFLICT (key) DO UPDATE SET text_value = EXCLUDED.text_value;
    END;
  END IF;
END
$do$;

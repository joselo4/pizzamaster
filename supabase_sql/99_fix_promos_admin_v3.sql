
-- 99_fix_promos_admin_v3.sql
-- A) /promo: config.promo_promos en formato legacy con imágenes
-- B) /promos y /promo/:slug: public.promotions con image_url/thumb_url (si existe)

DO $$
BEGIN
  IF EXISTS (select 1 from information_schema.tables where table_schema='public' and table_name='promotions') THEN
    EXECUTE $$
      insert into public.promotions as pr
        (slug,name,badge,headline,subheadline,price_text,detail_text,cta_label,cta_code,wa_message,image_url,thumb_url,active,starts_at,ends_at,sort_index)
      values
        ('2x1-hawaiana','2x1 Hawaiana','2x1','Paga 1 y llévate 2','Jamón + piña','S/ 0.00','2 pizzas (mismo tamaño)','Pedir ahora','2X1HAW','Hola 👋 Quiero la promo 2x1 Hawaiana.','/promos/2x1_hawaiana_banner.svg','/promos/2x1_hawaiana_square.svg',true,null,null,10),
        ('2x1-pepperoni','2x1 Pepperoni','2x1','Paga 1 y llévate 2','Pepperoni + queso','S/ 0.00','2 pizzas (mismo tamaño)','Pedir ahora','2X1PEP','Hola 👋 Quiero la promo 2x1 Pepperoni.','/promos/2x1_pepperoni_banner.svg','/promos/2x1_pepperoni_square.svg',true,null,null,11),
        ('2x1-americana','2x1 Americana','2x1','Paga 1 y llévate 2','Jamón + queso','S/ 0.00','2 pizzas (mismo tamaño)','Pedir ahora','2X1AME','Hola 👋 Quiero la promo 2x1 Americana.','/promos/2x1_americana_banner.svg','/promos/2x1_americana_square.svg',true,null,null,12),
        ('combo-familiar','Combo Familiar','TOP','2 medianas + 1.5L','Ideal para 4','S/ 0.00','2 pizzas medianas + bebida','Comprar combo','FAM','Hola 👋 Quiero el Combo Familiar.','/promos/combo_familiar_landscape.svg','/promos/combo_familiar_square.svg',true,null,null,2)
      on conflict (slug) do update set
        name=excluded.name,
        badge=excluded.badge,
        headline=excluded.headline,
        subheadline=excluded.subheadline,
        price_text=excluded.price_text,
        detail_text=excluded.detail_text,
        cta_label=excluded.cta_label,
        cta_code=excluded.cta_code,
        wa_message=excluded.wa_message,
        image_url=excluded.image_url,
        thumb_url=excluded.thumb_url,
        active=true,
        starts_at=null,
        ends_at=null,
        sort_index=excluded.sort_index;
    $$;
  END IF;
END $$;

DO $$
DECLARE
  v_json text := "[{\"tag\": \"2x1\", \"title\": \"2x1 Hawaiana\", \"price\": \"S/ 0.00\", \"note\": \"Jam\u00f3n + pi\u00f1a (mismo tama\u00f1o)\", \"promo\": \"2X1HAW\", \"bullets\": [\"Paga 1 y ll\u00e9vate 2\", \"V\u00e1lido hoy\", \"Delivery seg\u00fan zona\"], \"image\": \"/promos/2x1_hawaiana_banner.svg\", \"info_url\": \"/promo/2x1-hawaiana\"}, {\"tag\": \"2x1\", \"title\": \"2x1 Pepperoni\", \"price\": \"S/ 0.00\", \"note\": \"Pepperoni + queso (mismo tama\u00f1o)\", \"promo\": \"2X1PEP\", \"bullets\": [\"Paga 1 y ll\u00e9vate 2\", \"V\u00e1lido hoy\", \"Cupos limitados\"], \"image\": \"/promos/2x1_pepperoni_banner.svg\", \"info_url\": \"/promo/2x1-pepperoni\"}, {\"tag\": \"2x1\", \"title\": \"2x1 Americana\", \"price\": \"S/ 0.00\", \"note\": \"Jam\u00f3n + queso (mismo tama\u00f1o)\", \"promo\": \"2X1AME\", \"bullets\": [\"Paga 1 y ll\u00e9vate 2\", \"V\u00e1lido hoy\", \"Ideal para compartir\"], \"image\": \"/promos/2x1_americana_banner.svg\", \"info_url\": \"/promo/2x1-americana\"}, {\"tag\": \"FAMILIAR\", \"title\": \"Combo Familiar\", \"price\": \"S/ 0.00\", \"note\": \"2 medianas + bebida 1.5L\", \"promo\": \"FAM\", \"bullets\": [\"Ideal para 4\", \"Masa fina + queso full\", \"Ahorro real\"], \"image\": \"/promos/combo_familiar_landscape.svg\", \"info_url\": \"/promo/combo-familiar\"}]";
BEGIN
  IF EXISTS (select 1 from information_schema.tables where table_schema='public' and table_name='config') THEN
    BEGIN
      EXECUTE format($f$
        insert into public.config as c (key, value) values ('promo_active','true')
        on conflict (key) do update set value=excluded.value;
      $f$);
      EXECUTE format($f$
        insert into public.config as c (key, value) values ('promo_promos', %L)
        on conflict (key) do update set value=excluded.value;
      $f$, v_json);
    EXCEPTION WHEN undefined_column THEN
      EXECUTE format($f$
        insert into public.config as c (key, text_value) values ('promo_active','true')
        on conflict (key) do update set text_value=excluded.text_value;
      $f$);
      EXECUTE format($f$
        insert into public.config as c (key, text_value) values ('promo_promos', %L)
        on conflict (key) do update set text_value=excluded.text_value;
      $f$, v_json);
    END;
  END IF;
END $$;

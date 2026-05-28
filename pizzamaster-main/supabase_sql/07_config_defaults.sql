-- 07_config_defaults.sql
-- Crea/actualiza costo_delivery (config.numeric_value)
DO $$
BEGIN
  UPDATE public.config
     SET numeric_value = 2
   WHERE key = 'costo_delivery';

  IF NOT FOUND THEN
    INSERT INTO public.config(key, numeric_value)
    VALUES ('costo_delivery', 2);
  END IF;
END $$;

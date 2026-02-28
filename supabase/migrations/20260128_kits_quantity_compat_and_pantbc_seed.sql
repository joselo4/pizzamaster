-- 20260128_kits_quantity_compat_and_pantbc_seed.sql
ALTER TABLE public.kit_items
  ADD COLUMN IF NOT EXISTS quantity numeric(12,3) NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='kit_items' AND column_name='qty'
  ) THEN
    EXECUTE 'UPDATE public.kit_items SET quantity = COALESCE(NULLIF(quantity,0), qty)';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS kit_items_uq_kit_product ON public.kit_items(kit_id, product_id);
CREATE INDEX IF NOT EXISTS idx_kit_items_kit_id ON public.kit_items(kit_id);
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.kit_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kit_items TO authenticated;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kit_items_select_all ON public.kit_items;
CREATE POLICY kit_items_select_all ON public.kit_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS kit_items_write_auth ON public.kit_items;
CREATE POLICY kit_items_write_auth ON public.kit_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS stock_current numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS program_id text;
CREATE INDEX IF NOT EXISTS idx_products_program ON public.products(program_id);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='products_uq_name_program'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX products_uq_name_program ON public.products(UPPER(name), program_id)';
  END IF;
END $$;
INSERT INTO public.products (name, unit, program_id)
SELECT x.name, x.unit, x.program_id
FROM (
  VALUES
    ('ARROZ','KG','PANTBC'),
    ('MENESTRAS','KG','PANTBC'),
    ('ACEITE','LITRO','PANTBC'),
    ('AVENA','KG','PANTBC'),
    ('AZÚCAR','KG','PANTBC')
) AS x(name,unit,program_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p
  WHERE UPPER(p.name)=UPPER(x.name) AND p.program_id=x.program_id
);
NOTIFY pgrst, 'reload schema';

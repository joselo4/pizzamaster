-- 20260127_kits_bootstrap.sql
-- Bootstrap idempotente para Canastas (Kits) y sus Items (PANTBC)

CREATE TABLE IF NOT EXISTS public.kits (
  id bigserial PRIMARY KEY,
  program_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_kits_program_id ON public.kits(program_id);

CREATE TABLE IF NOT EXISTS public.kit_items (
  id bigserial PRIMARY KEY,
  kit_id bigint NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL DEFAULT 0
);

-- Compat: si existía columna qty, copiar a quantity
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='kit_items' AND column_name='qty'
  ) THEN
    EXECUTE 'UPDATE public.kit_items SET quantity = COALESCE(NULLIF(quantity,0), qty)';
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS kit_items_uq_kit_product ON public.kit_items(kit_id, product_id);
CREATE INDEX IF NOT EXISTS idx_kit_items_kit_id ON public.kit_items(kit_id);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kits TO authenticated;
GRANT SELECT ON public.kits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kit_items TO authenticated;
GRANT SELECT ON public.kit_items TO anon;

ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kits_select_all ON public.kits;
CREATE POLICY kits_select_all ON public.kits FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS kits_write_auth ON public.kits;
CREATE POLICY kits_write_auth ON public.kits FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS kit_items_select_all ON public.kit_items;
CREATE POLICY kit_items_select_all ON public.kit_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS kit_items_write_auth ON public.kit_items;
CREATE POLICY kit_items_write_auth ON public.kit_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

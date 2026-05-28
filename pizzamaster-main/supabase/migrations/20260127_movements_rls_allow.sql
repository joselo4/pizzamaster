-- 20260127_movements_rls_allow.sql
-- Permisos/RLS para que Kardex lea y la distribución inserte movimientos.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movements TO authenticated;
GRANT SELECT ON public.movements TO anon;

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS movements_select_all ON public.movements;
CREATE POLICY movements_select_all ON public.movements
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS movements_insert_auth ON public.movements;
CREATE POLICY movements_insert_auth ON public.movements
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS movements_update_auth ON public.movements;
CREATE POLICY movements_update_auth ON public.movements
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS movements_delete_auth ON public.movements;
CREATE POLICY movements_delete_auth ON public.movements
FOR DELETE TO authenticated
USING (true);

NOTIFY pgrst, 'reload schema';

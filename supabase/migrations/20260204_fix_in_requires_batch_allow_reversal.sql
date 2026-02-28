
-- 20260204_fix_in_requires_batch_allow_reversal.sql
-- Fix quirúrgico: permitir movimientos IN sin batch_id SOLO si son reversas (reversal_of no es null).
-- Esto evita el error al ANULAR PECOSA cuando los OUT históricos no tenían lote.
-- NO desactiva el control de lote para entradas normales.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname, p.oid as fn_oid, n.nspname, p.proname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.movements'::regclass
      AND NOT t.tgisinternal
  LOOP
    IF pg_get_functiondef(r.fn_oid) ILIKE '%IN requiere lote%' THEN
      -- Reemplazar la función manteniendo el mismo nombre
      EXECUTE format($f$
        CREATE OR REPLACE FUNCTION %I.%I()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF TG_OP IN ('INSERT','UPDATE')
            AND upper(coalesce(NEW.type,'')) = 'IN'
            AND NEW.batch_id IS NULL
            AND NEW.reversal_of IS NULL
          THEN
            RAISE EXCEPTION 'IN requiere lote (batch_id)';
          END IF;
          RETURN NEW;
        END;
        $$;
      $f$, r.nspname, r.proname);
    END IF;
  END LOOP;
END $$;

-- Recargar cache API
NOTIFY pgrst, 'reload schema';

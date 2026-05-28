-- ==========================================
-- 25_support_chats.sql
-- Estructura de base de datos para Asistente de Soporte (Virtual)
-- ==========================================

-- Renombrar tabla vieja si existe
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_chats') THEN
    ALTER TABLE public.ai_chats RENAME TO support_chats;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.support_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrar datos antiguos de sender de 'ai' a 'assistant' si existen
UPDATE public.support_chats SET sender = 'assistant' WHERE sender = 'ai';

-- Agregar constraint check seguro para emisor
ALTER TABLE public.support_chats DROP CONSTRAINT IF EXISTS support_chats_sender_check;
ALTER TABLE public.support_chats ADD CONSTRAINT support_chats_sender_check CHECK (sender IN ('customer', 'assistant'));

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;

-- Asegurar la existencia de la función session_role() para RLS (evita errores si no se corrió la estrategia de seguridad completa)
CREATE OR REPLACE FUNCTION public.session_role()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_token_text text;
  v_token uuid;
  v_role text;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operator_sessions') THEN
    BEGIN
      v_token_text := nullif(current_setting('request.headers', true)::jsonb ->> 'x-session-token', '');
      IF v_token_text IS NULL THEN
        RETURN NULL;
      END IF;
      v_token := v_token_text::uuid;
      SELECT role INTO v_role FROM public.operator_sessions 
      WHERE token = v_token AND revoked = false AND now() < expires_at LIMIT 1;
      RETURN v_role;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Políticas de Seguridad RLS
-- Permitir inserciones públicas (clientes enviando consultas)
DROP POLICY IF EXISTS "Allow public insert for ai_chats" ON public.support_chats;
DROP POLICY IF EXISTS "Allow public insert for support_chats" ON public.support_chats;
CREATE POLICY "Allow public insert for support_chats" 
ON public.support_chats 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Permitir consultas protegidas (solo el administrador o personal con sesión iniciada válida)
DROP POLICY IF EXISTS "Allow public select for ai_chats" ON public.support_chats;
DROP POLICY IF EXISTS "Allow select for support_chats" ON public.support_chats;
CREATE POLICY "Allow select for support_chats" 
ON public.support_chats 
FOR SELECT 
TO public 
USING (public.session_role() IS NOT NULL);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_support_chats_session_id ON public.support_chats(session_id);
CREATE INDEX IF NOT EXISTS idx_support_chats_created_at ON public.support_chats(created_at DESC);

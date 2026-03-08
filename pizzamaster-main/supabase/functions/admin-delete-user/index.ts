
// Supabase Edge Function: admin-delete-user
// Elimina un usuario de Auth y su fila en profiles. Debe ejecutarse con SERVICE_ROLE en el servidor.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: 'user_id requerido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente con el JWT del usuario que llama (para verificar admin)
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar admin por profiles.role
    const { data: me } = await userClient.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
    const isAdmin = String(me?.role ?? '').toUpperCase() === 'ADMIN';
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Solo ADMIN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cliente admin (service role)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) borrar perfil
    await admin.from('profiles').delete().eq('id', user_id);
    // 2) borrar auth
    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
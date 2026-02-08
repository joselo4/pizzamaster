/// <reference lib="deno.ns" />
/// <reference lib="deno.window" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Seguridad: secreto compartido (para llamadas desde cron/pg_net)
  const shared = Deno.env.get('TG_BACKUP_WEBHOOK_SECRET') || '';
  const incoming = req.headers.get('x-webhook-secret') || '';
  if (!shared || incoming !== shared) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Leer token y chat_id desde config (guardado en Admin > Config)
    const { data: cfgRows, error: cfgErr } = await sb.from('config').select('*');
    if (cfgErr) throw new Error(cfgErr.message);
    const cfg: Record<string, any> = {};
    (cfgRows || []).forEach((r: any) => (cfg[r.key] = r.text_value ?? r.numeric_value));

    const token = String(cfg.tg_token || '').trim();
    const chatId = String(cfg.tg_chat_id || '').trim();
    if (!token || !chatId) {
      return json({ ok: false, error: 'Faltan tg_token o tg_chat_id en config' }, 400);
    }

    const tables = ['orders', 'order_requests', 'products', 'customers', 'users', 'config', 'system_logs'];
    const backupData: Record<string, any> = { timestamp: new Date().toISOString() };

    for (const t of tables) {
      const { data, error } = await sb.from(t).select('*');
      if (error) throw new Error(`Error leyendo ${t}: ${error.message}`);
      backupData[t] = data;
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', blob, `backup_${new Date().toISOString().slice(0, 10)}.json`);
    formData.append('caption', `📦 Backup Sistema Pizza
📅 ${new Date().toLocaleString()}`);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const result = await res.json().catch(() => ({}));
    if (!result?.ok) {
      return json({ ok: false, error: result?.description || 'Telegram error' }, 500);
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

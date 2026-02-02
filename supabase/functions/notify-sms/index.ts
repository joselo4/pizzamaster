
/// <reference lib="deno.ns" />
/// <reference lib="deno.window" />

// Supabase Edge Function: notify-sms
// Env vars required (set in Supabase secrets):
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN      (o usa API Key + Secret; recomendado en producción)
// - TWILIO_FROM            (E.164, ej: +1..., si no usas Messaging Service)
// - TWILIO_MESSAGING_SERVICE_SID (opcional)
// - APP_PUBLIC_URL         (ej: https://tu-dominio.com)
// - WEBHOOK_SHARED_SECRET  (cadena aleatoria; NO la pegues en código)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type IncomingPayload = {
  to: string;
  order_id: number;
  status: string;
  service_type?: string;
  estimated_minutes?: number;
  public_token?: string;
  tracking_url?: string;
};

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePhoneE164(phone: string) {
  const p = phone.trim();
  if (p.startsWith('+')) return p;
  // Si te llega como 9 dígitos, asumimos Perú (+51). Ajusta si tu caso es distinto.
  const digits = p.replace(/\D/g, '');
  if (digits.length === 9) return `+51${digits}`;
  return `+${digits}`;
}

function buildMessage(params: {
  orderId: number;
  status: string;
  trackingUrl?: string;
  etaMin?: number;
  isPickup?: boolean;
}) {
  const { orderId, status, trackingUrl, etaMin, isPickup } = params;
  const eta = etaMin ? ` ETA aprox: ${etaMin} min.` : '';
  const track = trackingUrl ? `
Seguimiento: ${trackingUrl}` : '';

  switch (status) {
    case 'Pendiente':
      return `Pedido #${orderId} recibido. En proceso. ${eta}${track}`;
    case 'Horno':
      return `Pedido #${orderId} en preparación. ${eta}${track}`;
    case 'Listo':
      return isPickup
        ? `Pedido #${orderId} listo para recojo.${track}`
        : `Pedido #${orderId} listo. En breve sale a reparto.${track}`;
    case 'En Transporte':
      return `Pedido #${orderId} en camino.${track}`;
    case 'Entregado':
      return `Pedido #${orderId} entregado. ¡Gracias!`;
    case 'Recogido':
      return `Pedido #${orderId} recogido. ¡Gracias!`;
    case 'Cancelado':
      return `Pedido #${orderId} cancelado. Si necesitas ayuda, contáctanos.`;
    default:
      return `Pedido #${orderId} actualizado: ${status}.${track}`;
  }
}

async function sendSmsTwilio(to: string, body: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM') || '';
  const serviceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || '';

  if (!accountSid || !authToken) {
    throw new Error('Faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN en secrets');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const form = new URLSearchParams();
  form.set('To', to);
  form.set('Body', body);

  if (serviceSid) {
    form.set('MessagingServiceSid', serviceSid);
  } else {
    if (!from) throw new Error('Falta TWILIO_FROM (o define TWILIO_MESSAGING_SERVICE_SID)');
    form.set('From', from);
  }

  const basic = btoa(`${accountSid}:${authToken}`);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.message || data?.error_message || resp.statusText;
    throw new Error(`Twilio error: ${msg}`);
  }

  return data;
}

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    // Protección por secreto compartido
    const shared = Deno.env.get('WEBHOOK_SHARED_SECRET') || '';
    const incoming = req.headers.get('x-webhook-secret') || '';
    if (!shared || incoming !== shared) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const payload = (await req.json()) as Partial<IncomingPayload>;
    if (!payload.to || !payload.order_id || !payload.status) {
      return json({ error: 'Missing fields: to, order_id, status' }, 400);
    }

    const appUrl = Deno.env.get('APP_PUBLIC_URL') || '';
    const trackingUrl = payload.tracking_url || (appUrl && payload.public_token ? `${appUrl}/track/${payload.public_token}` : undefined);

    const message = buildMessage({
      orderId: payload.order_id,
      status: payload.status,
      trackingUrl,
      etaMin: payload.estimated_minutes,
      isPickup: payload.service_type === 'Local',
    });

    const toE164 = normalizePhoneE164(payload.to);
    const result = await sendSmsTwilio(toE164, message);

    return json({ ok: true, sid: result.sid, to: toE164, status: payload.status });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

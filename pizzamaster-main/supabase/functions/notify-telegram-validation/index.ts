/// <reference lib="deno.ns" />
/// <reference lib="deno.window" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function asText(value: unknown, fallback = "") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function buildMessage(payload: any, template: string) {
  const map: Record<string, string> = {
    order_id: asText(payload.order_id, "-"),
    request_id: asText(payload.request_id ?? payload.order_id, "-"),
    status: asText(payload.status, payload.test ? "PRUEBA" : "Nuevo"),
    client_name: asText(payload.client_name, payload.test ? "Prueba Admin" : "-"),
    client_phone: asText(payload.client_phone, "-"),
    client_address: asText(payload.client_address, "-"),
    service_type: asText(payload.service_type, "-"),
    total: asText(payload.total, "0.00"),
    notes: asText(payload.notes, payload.test ? "Mensaje de prueba desde Admin" : "-"),
    created_at: asText(payload.created_at, new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })),
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => map[key] ?? "");
}

const DEFAULT_TEMPLATE = [
  "Nuevo ingreso a validacion",
  "Pedido: #{{order_id}}",
  "Solicitud: #{{request_id}}",
  "Estado: {{status}}",
  "Cliente: {{client_name}}",
  "Telefono: {{client_phone}}",
  "Tipo: {{service_type}}",
  "Total: S/ {{total}}",
  "Direccion: {{client_address}}",
  "Notas: {{notes}}",
  "Hora: {{created_at}}",
].join("\n");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const sharedSecret = Deno.env.get("TELEGRAM_VALIDATION_WEBHOOK_SECRET") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const apiKeyHeader = req.headers.get("apikey") || "";
    const secretHeader = req.headers.get("x-webhook-secret") || "";
    const isAdminTest = payload?.test === true || payload?.source === "admin-test";
    const hasClientAuth = authHeader.startsWith("Bearer ") || apiKeyHeader.length > 0;

    if (sharedSecret && !isAdminTest && secretHeader !== sharedSecret && !hasClientAuth) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    if (!botToken) {
      return jsonResponse({ ok: false, error: "Missing TELEGRAM_BOT_TOKEN secret" }, 500);
    }

    const chatId = asText(payload?.chat_id, Deno.env.get("TELEGRAM_DEFAULT_CHAT_ID") || "");
    if (!chatId) {
      return jsonResponse({ ok: false, error: "Missing chat_id" }, 400);
    }

    const template = asText(payload?.template, DEFAULT_TEMPLATE);
    const message = buildMessage(payload, template);

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
      }),
    });

    const telegramData = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok || telegramData?.ok === false) {
      return jsonResponse({ ok: false, error: telegramData?.description || telegramResponse.statusText, telegram: telegramData }, 500);
    }

    return jsonResponse({ ok: true, sent_to: chatId, telegram: telegramData?.result || telegramData, preview: message });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

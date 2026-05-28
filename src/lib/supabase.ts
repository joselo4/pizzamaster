import { createClient } from '@supabase/supabase-js';

// Leemos las variables o usamos cadenas vacías para que no explote
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_KEY || "";

if (!url || !key) {
  console.warn("⚠️ ADVERTENCIA: No se encontraron las claves de Supabase. Revisa el archivo .env");
}

// Creamos un solo cliente (singleton) y evitamos múltiples instancias de GoTrueClient (HMR / re-render)
// En DEV con Vite, el módulo puede recargarse: cacheamos en globalThis para mantener una sola instancia.
const __g: any = globalThis as any;
if (!__g.__pizzaSessionToken) __g.__pizzaSessionToken = undefined;

export const supabase = __g.__pizzaSupabaseClient ?? (__g.__pizzaSupabaseClient = createClient(url, key, {
  global: {
    // Inyecta x-session-token sin recrear el cliente
    fetch: (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers || {});
      if (__g.__pizzaSessionToken) headers.set('x-session-token', __g.__pizzaSessionToken);
      init.headers = headers;
      return fetch(input, init);
    },
  },
}));

// Actualiza token en memoria (sin recrear supabase)
export function setSessionToken(token?: string) {
  __g.__pizzaSessionToken = token;
}

// Al iniciar, intenta cargar token de sesión guardado
try {
  const raw = localStorage.getItem('pizza_session');
  if (raw) {
    const parsed = JSON.parse(raw);
    const t = parsed?.user?.session_token;
    if (t) setSessionToken(t);
  }
} catch { /* ignore */ }

// FUNCIÓN DE LOG MEJORADA: Ahora acepta un orderId opcional
export const logAction = async (user: string, action: string, details: string = '', orderId?: number) => {
  if (!url || !key) return;
  
  let finalDetails = details;
  if (orderId) {
    finalDetails = `[Pedido #${orderId}] ${details}`;
  }

  try {
    await supabase.rpc('rpc_log_action', { p_user_name: user, p_action: action, p_details: finalDetails });
  } catch {
    // ignore
  }
};
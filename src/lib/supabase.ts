import { createClient } from '@supabase/supabase-js';

// Leemos las variables o usamos cadenas vacías para que no explote
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_KEY || "";

if (!url || !key) {
  console.warn("⚠️ ADVERTENCIA: No se encontraron las claves de Supabase. Revisa el archivo .env");
}

// Creamos el cliente de forma segura
export const supabase = createClient(url, key);

// FUNCIÓN DE LOG MEJORADA: Ahora acepta un orderId opcional
export const logAction = async (user: string, action: string, details: string = '', orderId?: number) => {
  if (!url || !key) return;
  
  let finalDetails = details;
  if (orderId) {
    finalDetails = `[Pedido #${orderId}] ${details}`;
  }

  await supabase.from('system_logs').insert({ 
    user_name: user, 
    action, 
    details: finalDetails 
  });
};
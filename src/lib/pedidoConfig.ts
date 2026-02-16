import { supabase } from './supabase';

const KEYS = [
  'costo_delivery',
  'delivery_fee',
  'tiempo_estimado_min',
  'estimated_minutes',
  'pedido_default_category',
  'delivery_gratis',
  'pedido_delivery_gratis',
  'free_delivery',
];

export async function fetchPedidoConfigMap() {
  const { data, error } = await supabase
    .from('config')
    .select('key, numeric_value, text_value')
    .in('key', KEYS);

  if (error) throw error;

  const c: Record<string, any> = {};
  (data || []).forEach((r: any) => {
    c[r.key] = r.numeric_value ?? r.text_value;
  });
  return c;
}

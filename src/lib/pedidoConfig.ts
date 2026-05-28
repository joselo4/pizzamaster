import { supabase } from './supabase';

const KEYS = [
  'costo_delivery',
  'delivery_fee',
  'tiempo_estimado_min',
  'estimated_minutes',
  'pedido_default_category',
  'pedido_default_tab',
  'pedido_categoria_inicial',
  // Orden exacto de tags visibles en /pedido y /pedidos
  'pedido_categories',
  'pedido_tabs',
  'pedido_tags',
  'delivery_gratis',
  'pedido_delivery_gratis',
  'free_delivery',
  // Ventana de atención
  'pedido_enabled',
  'pedido_disabled_message',
  // Botones globales
  'telefono_tienda',
  'promo_phone',
  'promo_wa_number',
  'wa_number',
];

export async function fetchPedidoConfigMap() {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .in('key', KEYS);

  if (error) throw error;

  const c: Record<string, any> = {};
  (data || []).forEach((r: any) => {
    c[r.key] = r.text_value ?? r.numeric_value ?? r.num_value ?? r.number_value ?? r.bool_value ?? r.value;
  });
  return c;
}

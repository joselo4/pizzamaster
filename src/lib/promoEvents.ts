import { supabase } from './supabase';

export type PromoEventType = 'view' | 'pedido_visit' | 'order_request';

export async function logPromoEvent(
  event: PromoEventType,
  payload: { campaign_id?: string | null; ref?: string | null; path?: string | null } = {}
) {
  try {
    const row: any = {
      event,
      campaign_id: payload.campaign_id ?? null,
      ref: payload.ref ?? null,
      path: payload.path ?? null,
    };
    // Tracking NO debe romper la app si no existe tabla/policy
    await supabase.from('promo_events').insert(row);
  } catch {
    // silent
  }
}

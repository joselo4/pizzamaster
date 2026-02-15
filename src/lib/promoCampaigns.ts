import { supabase } from './supabase';
import { getConfigCache, refreshConfigCache } from './configCache';

export type PromoCampaign = {
  id: string;
  name: string;
  active: boolean;
  priority?: number;
  headline: string;
  subheadline?: string;
  body?: string;
  price_text?: string;
  detail_text?: string;
  cta_label?: string;
  cta_code?: string;
  phone?: string | null;
  wa_number?: string | null;
  wa_message?: string | null;
  hero_image?: string | null;
  theme?: string;
  start_at?: string;
  end_at?: string;
  info_url?: string | null; // web informativa externa (opcional)
};

function normalizePhone(x: any): string | null {
  if (!x) return null;
  const s = String(x).replace(/\D/g, '');
  return s ? s : null;
}

export function slugify(input: any) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

function fromLegacy(cfg: any): PromoCampaign {
  return {
    id: 'carlos',
    name: 'Promo Carlos (original)',
    active: String(cfg?.promo_active ?? 'true') !== 'false',
    priority: 100,
    headline: String(cfg?.promo_headline ?? 'Carlos te engaña…'),
    subheadline: cfg?.promo_subheadline ?? 'pero con su dieta.',
    body: cfg?.promo_body ?? undefined,
    price_text: cfg?.promo_price_text ?? undefined,
    detail_text: cfg?.promo_detail_text ?? undefined,
    cta_label: cfg?.promo_cta_label ?? 'Pedir ahora',
    cta_code: cfg?.promo_cta_code ?? 'CARLOS10',
    phone: cfg?.promo_phone ?? null,
    wa_number: cfg?.promo_wa_number ?? null,
    wa_message: cfg?.promo_wa_message ?? null,
    hero_image: null,
    theme: 'amber',
    info_url: null,
  };
}

export async function getConfigPromoRaw(): Promise<any[]> {
  const cached: any = getConfigCache();
  const rawCached = cached?.promo_promos;
  if (rawCached) {
    try {
      const list = typeof rawCached === 'string' ? JSON.parse(rawCached) : rawCached;
      if (Array.isArray(list)) return list;
    } catch {}
  }
  const cfg: any = await refreshConfigCache();
  const raw = cfg?.promo_promos;
  if (!raw) return [];
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function loadPromoCampaigns(): Promise<PromoCampaign[]> {
  // 1) Intentar cache local (rápido)
  const cachedCfg: any = getConfigCache();
  const cachedRaw = cachedCfg?.promo_promos;
  if (cachedRaw) {
    try {
      const list = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
      if (Array.isArray(list) && list.length && typeof list[0] === 'object') {
        if ('id' in list[0] && (('headline' in list[0]) || ('name' in list[0]))) {
          return (list as any[]).map((c:any)=>({ ...c, info_url: c?.info_url ? String(c.info_url) : null }));
        }
      }
    } catch {}
  }

  // 2) Si no hay cache, refrescar desde DB
  const cfg: any = await refreshConfigCache();
  const raw = cfg?.promo_promos;

  if (raw) {
    try {
      const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(list) && list.length && typeof list[0] === 'object') {
        // campaigns format
        if ('id' in list[0] && (('headline' in list[0]) || ('name' in list[0]))) {
          return (list as any[]).map((c:any)=>({ ...c, info_url: c?.info_url ? String(c.info_url) : null }));
        }
      }
    } catch {
      // ignore
    }
  }

  return [fromLegacy(cfg)];
}

export function pickCampaign(list: PromoCampaign[], ref?: string | null): PromoCampaign | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const normalizedRef = ref ? String(ref).toLowerCase() : null;
  const byRef = normalizedRef ? list.find(c => c.active && String(c.id).toLowerCase() === normalizedRef) : null;
  if (byRef) return byRef;
  const actives = list.filter(c => c.active);
  const candidates = actives.length ? actives : list;
  return candidates.slice().sort((a,b)=> (b.priority ?? 0) - (a.priority ?? 0))[0];
}

export async function savePromoCampaigns(campaigns: PromoCampaign[], primaryId?: string) {
  const cfg: any = await refreshConfigCache();
  const hasCarlos = campaigns.some(c => c.id === 'carlos');
  const normalized = hasCarlos ? campaigns : [fromLegacy(cfg), ...campaigns];
  const normalized2 = normalized.map(c => ({ ...c, info_url: c.info_url ? String(c.info_url) : null }));

  const { error } = await supabase.from('config').upsert({
    key: 'promo_promos',
    text_value: JSON.stringify(normalized2)
  });
  if (error) throw error;

  const primary = primaryId ? normalized2.find(c => c.id === primaryId) : undefined;
  const selected = primary ?? pickCampaign(normalized2);
  if (selected) await syncLegacyPromoKeys(selected);
}

export async function syncLegacyPromoKeys(primary: PromoCampaign) {
  const rows = [
    { key:'promo_active',       text_value: String(primary.active ? 'true' : 'false') },
    { key:'promo_headline',     text_value: primary.headline ?? '' },
    { key:'promo_subheadline',  text_value: primary.subheadline ?? '' },
    { key:'promo_body',         text_value: primary.body ?? '' },
    { key:'promo_price_text',   text_value: primary.price_text ?? '' },
    { key:'promo_detail_text',  text_value: primary.detail_text ?? '' },
    { key:'promo_cta_label',    text_value: primary.cta_label ?? '' },
    { key:'promo_cta_code',     text_value: primary.cta_code ?? '' },
    { key:'promo_phone',        text_value: primary.phone ?? '' },
    { key:'promo_wa_number',    text_value: normalizePhone(primary.wa_number) ?? '' },
    { key:'promo_wa_message',   text_value: primary.wa_message ?? '' },
  ];
  const { error } = await supabase.from('config').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}

async function logEvent(event: 'view' | 'pedido_visit' | 'order_request', campaignId: string, ref?: string | null, path?: string, promoCode?: string | null) {
  try {
    const payload = {
      event,
      campaign_id: String(campaignId).slice(0,64),
      ref: ref ? String(ref).slice(0,64) : null,
      path: path ? String(path).slice(0,200) : null,
      promo_code: promoCode ? String(promoCode).slice(0,64) : null
    };
    await supabase.from('promo_events').insert(payload);
  } catch {
    // ignore
  }
}

export async function logPromoView(campaignId: string, ref?: string | null, path?: string) {
  return logEvent('view', campaignId, ref, path, null);
}

export async function logPedidoVisit(campaignId: string, ref?: string | null, path?: string) {
  return logEvent('pedido_visit', campaignId, ref, path, null);
}

export async function getPromoEvents(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('promo_events')
    .select('campaign_id,event,created_at')
    .gte('created_at', since);
  if (error || !data) return [] as any[];
  return data as any[];
}

export async function logOrderRequest(campaignId: string, ref?: string | null, path?: string, promoCode?: string | null) {
  return logEvent('order_request', campaignId, ref, path, promoCode ?? null);
}

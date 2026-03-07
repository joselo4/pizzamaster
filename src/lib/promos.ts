import { supabase } from './supabase';
import { getConfigCache, refreshConfigCache } from './configCache';

export interface Promotion {
  id: number;
  slug: string;
  name: string;
  badge?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  body?: string | null;
  price_text?: string | null;
  detail_text?: string | null;
  cta_label?: string | null;
  cta_code?: string | null;
  cta_url?: string | null;
  phone?: string | null;
  wa_number?: string | null;
  wa_message?: string | null;
  image_url?: string | null;
  thumb_url?: string | null;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
}

export async function listActivePromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  // La policy pública ya filtra activas/vigentes. Igual devolvemos array.
  return (data || []) as Promotion[];
}

export async function listAllPromotionsStaff(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('active', { ascending: false })
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Promotion[];
}


export async function getPromotionBySlug(slug: string): Promise<Promotion | null> {
  // 1) DB primero (promotions)
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (data) return (data || null) as Promotion | null;

  // 2) Fallback: config.promo_promos (lo que se ve en /promo)
  const slugifyLocal = (input: string) =>
    String(input || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80);

  const safeJson = <T,>(raw: any, fallback: T): T => {
    try {
      if (!raw || typeof raw !== 'string') return fallback;
      const v = JSON.parse(raw);
      return (v ?? fallback) as T;
    } catch {
      return fallback;
    }
  };

  const buildFromCfg = (cfg: any): Promotion[] => {
    const raw = safeJson<any[]>(cfg?.promo_promos, []);
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const first: any = raw[0] || {};
    const looksLikeCampaign = ('id' in first) && (('headline' in first) || ('name' in first));
    const now = new Date().toISOString();

    if (looksLikeCampaign) {
      return (raw as any[])
        .filter((c: any) => c?.active !== false)
        .map((c: any, idx: number) => {
          const s = String(c?.slug || c?.id || slugifyLocal(c?.headline || c?.name || String(idx + 1)) || String(idx + 1));
          const name = String(c?.headline || c?.name || c?.id || 'Promo');
          return {
            id: Number(c?.id) || (idx + 1),
            slug: s,
            name,
            badge: c?.badge ?? 'PROMO',
            headline: c?.headline ?? null,
            subheadline: c?.subheadline ?? null,
            body: c?.body ?? null,
            price_text: c?.price_text ?? null,
            detail_text: c?.detail_text ?? null,
            cta_label: c?.cta_label ?? null,
            cta_code: c?.cta_code ?? null,
            cta_url: c?.cta_url ?? null,
            phone: c?.phone ?? null,
            wa_number: c?.wa_number ?? null,
            wa_message: c?.wa_message ?? null,
            image_url: c?.hero_image ?? c?.image_url ?? null,
            thumb_url: c?.thumb_url ?? null,
            active: true,
            starts_at: c?.start_at ?? c?.starts_at ?? null,
            ends_at: c?.end_at ?? c?.ends_at ?? null,
            sort_index: Number(c?.sort_index) || idx,
            created_at: c?.created_at ?? now,
            updated_at: c?.updated_at ?? now,
          } as Promotion;
        });
    }

    // legacy: { tag,title,price,note,promo,bullets,thumb_url,image_url }
    return (raw as any[])
      .filter((p: any) => p?.active !== false)
      .map((p: any, idx: number) => {
        const title = String(p?.title || p?.tag || 'Promo');
        const code = String(p?.promo || '');
        const s = String(p?.slug || (code ? slugifyLocal(code) : slugifyLocal(title)) || String(idx + 1));
        return {
          id: idx + 1,
          slug: s,
          name: title,
          badge: String(p?.tag || 'PROMO'),
          headline: title,
          subheadline: p?.note ? String(p.note) : null,
          body: null,
          price_text: p?.price ? String(p.price) : null,
          detail_text: p?.note ? String(p.note) : null,
          cta_label: null,
          cta_code: code || null,
          cta_url: null,
          phone: null,
          wa_number: null,
          wa_message: null,
          image_url: p?.image_url ?? null,
          thumb_url: p?.thumb_url ?? null,
          active: true,
          starts_at: null,
          ends_at: null,
          sort_index: idx,
          created_at: now,
          updated_at: now,
        } as Promotion;
      });
  };

  // cache primero
  let cfg = getConfigCache();
  let list = buildFromCfg(cfg);
  let found = list.find((x) => String(x.slug) === String(slug));
  if (found) return found;

  // refresco después
  try {
    cfg = await refreshConfigCache();
    list = buildFromCfg(cfg);
    found = list.find((x) => String(x.slug) === String(slug));
    return found || null;
  } catch {
    return null;
  }
}

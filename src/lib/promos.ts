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


function normalizeSlugForLookup(x: string): string {
  return String(x || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugifyLocal(input: string): string {
  return normalizeSlugForLookup(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
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
  const wanted = normalizeSlugForLookup(slug);
  const { data, error } = await supabase.from('promotions').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (data) return (data || null) as Promotion | null;

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
    const now = new Date().toISOString();
    return (raw as any[])
      .filter((p:any) => p?.active !== false)
      .map((p:any, idx:number) => {
        const title = String(p?.title || p?.headline || p?.name || p?.tag || 'Promo');
        const code = String(p?.promo || p?.cta_code || '');
        const slugGuess = String(p?.slug || (code ? slugifyLocal(code) : slugifyLocal(title)) || String(idx+1));
        return {
          id: Number(p?.id) || (idx+1),
          slug: slugGuess,
          name: title,
          badge: String(p?.tag || p?.badge || 'PROMO'),
          headline: String(p?.headline || title),
          subheadline: p?.note ? String(p.note) : (p?.subheadline ? String(p.subheadline) : null),
          body: p?.body ?? null,
          price_text: p?.price ? String(p.price) : (p?.price_text ? String(p.price_text) : null),
          detail_text: p?.detail_text ?? null,
          cta_label: p?.cta_label ?? null,
          cta_code: code || null,
          cta_url: p?.cta_url ?? null,
          phone: p?.phone ?? null,
          wa_number: p?.wa_number ?? null,
          wa_message: p?.wa_message ?? null,
          image_url: p?.image_url ?? p?.hero_image ?? null,
          thumb_url: null,
          active: true,
          starts_at: p?.starts_at ?? p?.start_at ?? null,
          ends_at: p?.ends_at ?? p?.end_at ?? null,
          sort_index: Number(p?.sort_index) || idx,
          created_at: p?.created_at ?? now,
          updated_at: p?.updated_at ?? now,
        } as Promotion;
      });
  };

  const matchAny = (p: Promotion) => {
    const a = normalizeSlugForLookup(String(p.slug));
    const b = normalizeSlugForLookup(String((p as any).cta_code || ''));
    const c = normalizeSlugForLookup(String((p as any).name || ''));
    const d = slugifyLocal(String((p as any).cta_code || (p as any).name || ''));
    return [a,b,c,d].includes(wanted);
  };

  let cfg = getConfigCache();
  let list = buildFromCfg(cfg);
  let found = list.find(matchAny);
  if (found) return found;
  try {
    cfg = await refreshConfigCache();
    list = buildFromCfg(cfg);
    found = list.find(matchAny);
    return found || null;
  } catch {
    return null;
  }
}

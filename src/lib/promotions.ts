import { supabase } from './supabase';

export type PromotionStatus = 'active' | 'paused' | 'archived';

export type Promotion = {
  id: number;
  slug: string | null;
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
  hero_url?: string | null;
  image_url?: string | null;
  thumb_url?: string | null;
  channels: string[];
  status: PromotionStatus;
  active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  priority: number;
  sort_index?: number | null;
  created_at?: string;
  updated_at?: string;
};

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function buildPromoPublicUrl(origin: string, slugOrId: string | number) {
  return `${origin}/p/${slugOrId}`;
}

export function buildWhatsAppUrl(wa_number?: string | null, wa_message?: string | null) {
  if (!wa_number) return null;
  const msg = encodeURIComponent(wa_message ?? 'Hola, quiero esta promo');
  const num = wa_number.replace(/[^0-9]/g, '');
  return `https://wa.me/${num}?text=${msg}`;
}

export function buildTelUrl(phone?: string | null) {
  if (!phone) return null;
  const num = phone.replace(/[^0-9+]/g, '');
  return `tel:${num}`;
}

export async function listPromotions() {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('priority', { ascending: true })
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Promotion[];
}

export async function listPublicPromotions() {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Promotion[];
}

export async function createPromotion(p: Partial<Promotion>) {
  const payload: any = { ...p };
  if (!payload.slug && payload.name) payload.slug = slugify(String(payload.name));
  if (!payload.channels) payload.channels = ['web','pos'];
  if (!payload.status) payload.status = 'active';
  if (payload.active === undefined) payload.active = payload.status === 'active';
  const { data, error } = await supabase.from('promotions').insert(payload).select('*').single();
  if (error) throw error;
  return data as Promotion;
}

export async function updatePromotion(id: number, p: Partial<Promotion>) {
  const payload: any = { ...p };
  if (payload.name && !payload.slug) payload.slug = slugify(String(payload.name));
  if (payload.status) payload.active = payload.status === 'active';
  const { data, error } = await supabase.from('promotions').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Promotion;
}

export async function setPromotionStatus(id: number, status: PromotionStatus) {
  return updatePromotion(id, { status });
}

export async function deletePromotion(id: number) {
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) throw error;
}

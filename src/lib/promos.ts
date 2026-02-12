import { supabase } from './supabase';

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
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as Promotion | null;
}

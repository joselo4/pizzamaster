import { useEffect, useMemo, useState } from 'react';
import { supabase, SUPABASE_ENV_STATE } from '../lib/supabase';
import { useStoreConfig } from './useStoreConfig';
import { resolveFeaturedPromotion } from '../core/services/businessRules';

export type UnifiedPromotion = {
  id?: string | number;
  slug?: string;
  title: string;
  price_text?: string;
  detail_text?: string;
  image_url?: string;
  active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  source: 'db' | 'config';
};

export function useUnifiedPromotions() {
  const { config } = useStoreConfig();
  const [items, setItems] = useState<UnifiedPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      if (SUPABASE_ENV_STATE.isConfigured) {
        try {
          const { data, error } = await supabase
            .from('promotions')
            .select('id,slug,title,price_text,detail_text,image_url,active,starts_at,ends_at')
            .order('title');
          if (!error && mounted && Array.isArray(data) && data.length > 0) {
            setItems(data.map((row: any) => ({ ...row, source: 'db' })));
            return;
          }
        } catch {
          // fallback silencioso
        }
      }

      try {
        const raw = typeof config.promo_promos === 'string' ? JSON.parse(config.promo_promos) : [];
        if (mounted && Array.isArray(raw)) {
          setItems(raw.map((item: any, index: number) => ({
            id: index,
            slug: item.slug || item.code || `promo-${index + 1}`,
            title: item.title || item.name || `Promo ${index + 1}`,
            price_text: item.price_text || item.price || '',
            detail_text: item.detail_text || item.note || '',
            image_url: item.image_url || item.thumb_url || '',
            active: item.active !== false,
            starts_at: item.starts_at || null,
            ends_at: item.ends_at || null,
            source: 'config',
          })));
        }
      } catch {
        if (mounted) setItems([]);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [config]);

  const featured = useMemo(() => resolveFeaturedPromotion(items, new Date()), [items]);
  return { items, featured, isLoading };
}

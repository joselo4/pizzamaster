import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

/**
 * Devuelve un mapa key->value de app_settings.
 * Se usa para configuración global (incluye PECOSA style/layout) sin duplicar queries.
 */
export function useAppSettingsMap() {
  return useQuery({
    queryKey: ['app_settings_map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*');
      if (error) throw error;
      const m: any = {};
      (data ?? []).forEach((d: any) => (m[d.key] = d.value));
      return m as Record<string, any>;
    },
    staleTime: 10_000,
  });
}

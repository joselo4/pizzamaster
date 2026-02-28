
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

export function useFlag(key: string, def=false) {
  const { data } = useQuery({
    queryKey: ['flag', key],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').eq('key', key).maybeSingle();
      if (error) throw error;
      return data?.value;
    },
    staleTime: 60_000,
  });
  if (data === undefined || data === null) return def;
  return String(data).toLowerCase() === 'true';
}

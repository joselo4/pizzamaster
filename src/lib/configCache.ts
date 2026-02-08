import { supabase } from './supabase';

const CACHE_KEY = 'pizza_config_cache_v1';
export type ConfigMap = Record<string, any>;

export function getConfigCache(): ConfigMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setConfigCache(map: ConfigMap) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map || {}));
  } catch {
    // ignore
  }
}

export async function refreshConfigCache(): Promise<ConfigMap> {
  const { data } = await supabase.from('config').select('*');
  const c: ConfigMap = {};
  (data || []).forEach((r: any) => {
    c[r.key] = r.text_value ?? r.num_value ?? r.bool_value ?? r.value ?? null;
  });
  setConfigCache(c);
  return c;
}

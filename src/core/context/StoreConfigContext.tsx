import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, SUPABASE_ENV_STATE } from '../../lib/supabase';

export type StoreConfigMap = Record<string, string | number | boolean | null>;

type StoreConfigContextValue = {
  config: StoreConfigMap;
  isLoading: boolean;
  refreshedAt: string | null;
  refresh: () => Promise<void>;
  getText: (key: string, fallback?: string) => string;
  getNumber: (key: string, fallback?: number) => number;
  getBoolean: (key: string, fallback?: boolean) => boolean;
};

const StoreConfigContext = createContext<StoreConfigContextValue | undefined>(undefined);
const CACHE_KEY = 'pizza_store_config_v3';

function normalizeRow(row: any): string | number | boolean | null {
  if (typeof row?.text_value === 'string' && row.text_value !== '') return row.text_value;
  if (typeof row?.num_value === 'number') return row.num_value;
  if (typeof row?.numeric_value === 'number') return row.numeric_value;
  if (typeof row?.bool_value === 'boolean') return row.bool_value;
  return null;
}

export function StoreConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StoreConfigMap>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!SUPABASE_ENV_STATE.isConfigured) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('config')
        .select('key,text_value,num_value,numeric_value,bool_value')
        .limit(500);
      if (error) throw error;
      const next = Object.fromEntries((data || []).map((row: any) => [row.key, normalizeRow(row)]));
      setConfig(next);
      setRefreshedAt(new Date().toISOString());
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      }
    } catch {
      // fallback silencioso
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<StoreConfigContextValue>(() => ({
    config,
    isLoading,
    refreshedAt,
    refresh,
    getText: (key, fallback = '') => {
      const raw = config[key];
      return typeof raw === 'string' ? raw : fallback;
    },
    getNumber: (key, fallback = 0) => {
      const raw = config[key];
      return typeof raw === 'number' ? raw : fallback;
    },
    getBoolean: (key, fallback = false) => {
      const raw = config[key];
      return typeof raw === 'boolean' ? raw : fallback;
    },
  }), [config, isLoading, refreshedAt, refresh]);

  return <StoreConfigContext.Provider value={value}>{children}</StoreConfigContext.Provider>;
}

export function useStoreConfigContext() {
  const ctx = useContext(StoreConfigContext);
  if (!ctx) throw new Error('useStoreConfigContext must be used inside StoreConfigProvider');
  return ctx;
}

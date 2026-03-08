import { useEffect, useRef, useState } from 'react';
import { supabase } from '../api/supabase';

export type DbHealthStatus = 'online' | 'offline' | 'waking';

export type DbHealth = {
  status: DbHealthStatus;
  latencyMs: number | null;
  lastOkAt: string | null;
  lastError: string | null;
};

export async function pingDb(): Promise<DbHealth> {
  const t0 = Date.now();
  try {
    // Ping ultra ligero (sirve para "despertar" si el proyecto está pausado)
    const { error } = await supabase.from('app_settings').select('key').limit(1);
    if (error) throw error;
    return { status: 'online', latencyMs: Date.now() - t0, lastOkAt: new Date().toISOString(), lastError: null };
  } catch (e: any) {
    const msg = String(e?.message || e);
    return { status: 'offline', latencyMs: null, lastOkAt: null, lastError: msg };
  }
}

export function useDbHealth(intervalMs = 30_000) {
  const [health, setHealth] = useState<DbHealth>({ status: 'waking', latencyMs: null, lastOkAt: null, lastError: null });
  const timer = useRef<any>(null);

  const refresh = async () => {
    setHealth(h => ({ ...h, status: 'waking' }));
    const next = await pingDb();
    setHealth(prev => ({
      status: next.status,
      latencyMs: next.latencyMs,
      lastOkAt: next.lastOkAt || prev.lastOkAt,
      lastError: next.lastError,
    }));
    return next;
  };

  useEffect(() => {
    refresh();
    timer.current = setInterval(() => refresh(), intervalMs);
    return () => {
      try { clearInterval(timer.current); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { health, refresh };
}

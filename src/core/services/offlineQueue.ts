import { supabase } from '../api/supabase';

export type OfflineItem = {
  id: string;
  table: string;
  payload: any;
  createdAt: string;
  attempts: number;
};

const KEY = 'offline_queue_v1';

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function getQueue(): OfflineItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setQueue(items: OfflineItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

export function enqueue(table: string, payload: any) {
  const q = getQueue();
  q.push({ id: uid(), table, payload, createdAt: new Date().toISOString(), attempts: 0 });
  setQueue(q);
}

export function clearQueue() {
  setQueue([]);
}

function isOfflineError(e: any) {
  const msg = String(e?.message || e || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('fetch') || msg.includes('network');
}

export async function safeInsert(table: string, payload: any) {
  try {
    const { error } = await supabase.from(table).insert(payload);
    if (error) throw error;
    return { ok: true, queued: false };
  } catch (e: any) {
    if (isOfflineError(e)) {
      enqueue(table, payload);
      return { ok: true, queued: true };
    }
    throw e;
  }
}

export async function syncQueue(maxItems = 50) {
  const q = getQueue();
  if (!q.length) return { synced: 0, remaining: 0 };

  let synced = 0;
  const next: OfflineItem[] = [];

  for (const item of q.slice(0, maxItems)) {
    try {
      const { error } = await supabase.from(item.table).insert(item.payload);
      if (error) throw error;
      synced += 1;
    } catch (e: any) {
      // Si sigue offline o falla: reintenta luego
      const it = { ...item, attempts: (item.attempts || 0) + 1 };
      next.push(it);
      if (!isOfflineError(e)) {
        // si es error lógico, no insistir demasiado: igual lo dejamos para inspección
      }
    }
  }

  // Mantener los que no procesamos + los fallidos
  const remaining = q.slice(maxItems).concat(next);
  setQueue(remaining);
  return { synced, remaining: remaining.length };
}

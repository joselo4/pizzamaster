
import { supabase } from '../api/supabase';

const KEY = 'offline-mutations-v1';

type Mut = { table:string; action:'insert'|'update'|'delete'|'upsert'; payload:any; match?: Record<string,any> };

function load(): Mut[] { try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; } }
function save(list: Mut[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} }

export async function processQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const list = load();
  const rest: Mut[] = [];
  for (const m of list) {
    try {
      if (m.action==='insert') await supabase.from(m.table).insert(m.payload);
      else if (m.action==='update') await supabase.from(m.table).update(m.payload).match(m.match||{});
      else if (m.action==='delete') await supabase.from(m.table).delete().match(m.match||{});
      else if (m.action==='upsert') await supabase.from(m.table).upsert(m.payload);
    } catch {
      rest.push(m);
    }
  }
  save(rest);
}

export async function safeUpdate(table:string, payload:any, match:Record<string,any>) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const list = load(); list.push({ table, action:'update', payload, match }); save(list);
    return { offline:true } as any;
  }
  return supabase.from(table).update(payload).match(match);
}

export async function safeInsert(table:string, payload:any) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const list = load(); list.push({ table, action:'insert', payload }); save(list);
    return { offline:true } as any;
  }
  return supabase.from(table).insert(payload);
}

export async function safeUpsert(table:string, payload:any) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const list = load(); list.push({ table, action:'upsert', payload }); save(list);
    return { offline:true } as any;
  }
  return supabase.from(table).upsert(payload);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', ()=> { processQueue(); });
  window.addEventListener('focus', ()=> { processQueue(); });
}

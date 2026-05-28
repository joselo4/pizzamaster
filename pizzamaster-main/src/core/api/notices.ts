import { supabase } from './supabase';

export type NoticeSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface NoticeItem {
  id: string;
  title: string;
  message: string;
  severity: NoticeSeverity;
  createdAt: string;
  createdBy: string;
  expiresAt?: string | null;
}

export interface NoticesPayload {
  updatedAt: string;
  updatedBy: string;
  items: NoticeItem[];
}

const keyForProgram = (program: string) => `avisos_${program}`;

export const isNoticeActive = (n: NoticeItem) => {
  if (!n.expiresAt) return true;
  const exp = new Date(n.expiresAt).getTime();
  return Number.isFinite(exp) ? exp > Date.now() : true;
};

export const activeNotices = (payload?: NoticesPayload | null) => (payload?.items || []).filter(isNoticeActive);

export async function fetchNotices(program: string): Promise<NoticesPayload | null> {
  const key = keyForProgram(program);
  const { data, error } = await supabase.from('app_settings').select('*').eq('key', key).maybeSingle();
  if (error) throw error;
  if (!data?.value) return null;
  try {
    return JSON.parse(data.value);
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
      items: [{
        id: 'legacy',
        title: 'AVISO',
        message: String(data.value),
        severity: 'INFO',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        expiresAt: null,
      }],
    };
  }
}

export async function saveNotices(program: string, payload: NoticesPayload) {
  const key = keyForProgram(program);
  const { error } = await supabase.from('app_settings').upsert({ key, value: JSON.stringify(payload) }, { onConflict: 'key' });
  if (error) throw error;
}

import { supabase } from './supabase';
export type Permission = string;

export async function resolvePermissions(userId: string | number, fallback: Permission[] = []) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role:roles(name, permissions)')
      .eq('user_id', userId);
    if (error) return fallback;
    const perms = new Set<Permission>(fallback);
    for (const row of (data || []) as any[]) {
      const role = (row as any).role;
      const list = role?.permissions || [];
      if (Array.isArray(list)) list.forEach((p:any)=>perms.add(String(p)));
    }
    return Array.from(perms);
  } catch {
    return fallback;
  }
}

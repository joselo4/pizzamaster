
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { useAuth } from '../context/AuthContext';


export type PermissionKey =
  | 'all'
  | 'pecosas:view' | 'pecosas:edit'
  | 'patients:edit'
  | 'closure:view'
  | 'health:view'
  | 'settings:admin'
  | 'notices:edit'
  | 'module:inventory'
  | 'module:distribution'
  | 'module:directory'
  | 'module:reports'
  | 'module:notices'
  | 'module:settings'
  | 'module:summary'
  | 'module:transfer'
  | 'module:globalstock'
  | 'inventory:write'
  | 'distribution:write';


const baseByRole = (role?: string) => {
  const r = String(role || '').toLowerCase();

  // Por defecto, NO cambiamos la visibilidad de módulos: todo visible.
  const modules = {
    'module:inventory': true,
    'module:distribution': true,
    'module:directory': true,
    'module:reports': true,
    'module:notices': true,
    'module:settings': true,
    'module:summary': true,
  } as any;

  if (r === 'admin') return { all: true, ...modules } as any;
  if (r === 'operator' || r === 'operador') {
    return {
      ...modules,
      'pecosas:view': true,
      'pecosas:edit': true,
      'patients:edit': true,
      'closure:view': true,
      'health:view': true,
      // Por defecto: edición de avisos solo ADMIN, pero puede ser habilitada por override.
      'notices:edit': false,
    } as any;
  }

  // viewer / otros
  return {
    ...modules,
    'pecosas:view': true,
    'closure:view': true,
    'health:view': true,
    'notices:edit': false,
  } as any;
};

export function usePermissions2() {
  const { session, role } = useAuth();
  const userId = session?.user?.id;
  const base = baseByRole(role);

  const { data } = useQuery({
    queryKey: ['user_permissions', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from('user_permissions').select('permissions').eq('user_id', userId).maybeSingle();
      if (error) return null;
      return data?.permissions || null;
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const overrides: any = data || {};

  const can = (perm: PermissionKey) => {
  // 1) Override total explícito
  if (typeof overrides?.all === 'boolean') {
    if (overrides.all === true) return true;
    if (overrides.all === false) return false;
  }

  // 2) Override específico por permiso (gana incluso si el rol base es admin)
  if (typeof overrides?.[perm] === 'boolean') return overrides[perm];

  // 3) Rol base
  if ((base as any).all) return true;
  return Boolean((base as any)[perm]);
};

  return { can, overrides };
}
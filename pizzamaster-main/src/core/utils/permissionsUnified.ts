import { usePermissions2 } from './permissions2';

/**
 * Adaptador quirúrgico: un solo motor de permisos (permissions2) y helpers derivados.
 */
export function usePermissions() {
  const { can, overrides } = usePermissions2();
  const isAdmin = () => can('settings:admin');
  const isViewer = () => !can('inventory:write') && !can('distribution:write');
  return { can, overrides, isAdmin, isViewer };
}

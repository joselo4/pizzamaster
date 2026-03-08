
import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { usePermissions, PermissionKey } from '../utils/permissions2';

export const AccessGuard = ({ perm, children }: { perm: PermissionKey; children: ReactNode }) => {
  const { can } = usePermissions();
  if (can(perm)) return <>{children}</>;
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white border rounded p-6 text-center shadow-sm">
        <Lock size={42} className="mx-auto mb-2" />
        <div className="font-extrabold">ACCESO RESTRINGIDO</div>
        <div className="text-xs text-gray-500 mt-1">No tienes permisos para ver esta sección.</div>
      </div>
    </div>
  );
};

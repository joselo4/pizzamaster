import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export function usePermissionMatrix() {
  const { user } = useAuth();
  return useMemo(() => {
    const raw = Array.isArray(user?.permissions) ? user.permissions : [];
    const values = raw.filter(Boolean) as string[];
    const grouped = {
      operaciones: values.filter((item) => /delivery|kitchen|cashier|pos|pedido|validation/i.test(item)),
      control: values.filter((item) => /admin|audit|report|dashboard|logs|health/i.test(item)),
      catalogos: values.filter((item) => /product|user|client|patient|center|config|promo/i.test(item)),
    };
    return {
      role: user?.role || 'viewer',
      values,
      grouped,
      total: values.length,
      can: (permission: string) => values.includes(permission),
    };
  }, [user]);
}

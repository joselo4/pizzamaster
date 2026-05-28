export const normalizeRole = (role?: string | null): string => (role || '').toString().trim().toUpperCase();

export const isAdmin = (role?: string | null) => normalizeRole(role) === 'ADMIN';
export const isOperator = (role?: string | null) => {
  const r = normalizeRole(role);
  return r === 'OPERATOR' || r === 'OPERADOR';
};
export const isViewer = (role?: string | null) => normalizeRole(role) === 'VIEWER';

export const canWrite = (role?: string | null) => !isViewer(role);
export const canEditNotices = (role?: string | null) => isAdmin(role);

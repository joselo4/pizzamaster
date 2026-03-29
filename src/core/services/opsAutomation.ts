export type OpsChecklistItem = {
  title: string;
  status: 'done' | 'pending' | 'watch';
  detail: string;
};

export function buildOpsChecklist(input: {
  hasUnifiedConfig: boolean;
  hasSecurityPreflight: boolean;
  hasMaintenanceSql: boolean;
  notificationsReady: boolean;
  permissionsCentralized: boolean;
}): OpsChecklistItem[] {
  return [
    {
      title: 'Configuración centralizada',
      status: input.hasUnifiedConfig ? 'done' : 'pending',
      detail: input.hasUnifiedConfig ? 'StoreConfigProvider activo.' : 'Falta conectar módulos legacy al contexto global.',
    },
    {
      title: 'Preflight de seguridad',
      status: input.hasSecurityPreflight ? 'done' : 'pending',
      detail: input.hasSecurityPreflight ? 'Hay script de revisión de secretos antes de publicar.' : 'Agrega revisión automatizada de .env y tokens.',
    },
    {
      title: 'Mantenimiento automatizado',
      status: input.hasMaintenanceSql ? 'done' : 'watch',
      detail: input.hasMaintenanceSql ? 'Existe SQL base para limpieza de logs/backups.' : 'Recomendado: pg_cron para client_errors, audit_logs y backups.',
    },
    {
      title: 'Centro de notificaciones',
      status: input.notificationsReady ? 'done' : 'watch',
      detail: input.notificationsReady ? 'Plantillas y cola central unificadas.' : 'Conviene consolidar SMS/WhatsApp/Dashboard en un servicio único.',
    },
    {
      title: 'Permisos centralizados',
      status: input.permissionsCentralized ? 'done' : 'pending',
      detail: input.permissionsCentralized ? 'Hook usePermissionMatrix agregado.' : 'Falta retirar helpers legacy.',
    },
  ];
}

export function summarizeAutomation(readiness: OpsChecklistItem[]) {
  const done = readiness.filter((item) => item.status === 'done').length;
  const pending = readiness.filter((item) => item.status === 'pending').length;
  const watch = readiness.filter((item) => item.status === 'watch').length;
  return { done, pending, watch };
}

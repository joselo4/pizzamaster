export type NotificationChannel = 'sms' | 'whatsapp' | 'dashboard' | 'email';

export type NotificationPayload = {
  channel: NotificationChannel;
  title: string;
  body: string;
  createdAt?: string;
  orderId?: string | number | null;
  status?: string | null;
};

const STORAGE_KEY = 'pizza_notification_history_v1';

export function buildOrderNotification(status: string, customerName = 'Cliente', trackingCode = '') {
  const shared = trackingCode ? ` Código: ${trackingCode}.` : '';
  const map: Record<string, string> = {
    Pendiente: `${customerName}, recibimos tu pedido.${shared}`,
    Validado: `${customerName}, tu pedido fue validado y entró a preparación.${shared}`,
    Horno: `${customerName}, tu pedido está en horno.${shared}`,
    Listo: `${customerName}, tu pedido está listo para entrega o recojo.${shared}`,
    'En Transporte': `${customerName}, tu pedido va en camino.${shared}`,
    Entregado: `${customerName}, tu pedido fue entregado con éxito.${shared}`,
    Recogido: `${customerName}, tu pedido fue recogido.${shared}`,
    Cancelado: `${customerName}, tu pedido fue cancelado. Si necesitas ayuda, contáctanos.${shared}`,
  };
  return map[status] || `${customerName}, tu pedido cambió a estado ${status}.${shared}`;
}

export function enqueueNotification(payload: NotificationPayload) {
  if (typeof window === 'undefined') return;
  const current = listNotifications();
  current.unshift({ ...payload, createdAt: payload.createdAt || new Date().toISOString() });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(0, 50)));
}

export function listNotifications(): NotificationPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

import type { OrderStatus, ServiceType } from '../types';
import { getConfigCache } from './configCache';

function renderTemplate(tpl: string, vars: Record<string, string | number | undefined | null>) {
  const filled = (tpl || '').replace(/\{(\w+)\}/g, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
  // Reduce 3+ consecutive newlines to 2 (safe in all bundlers)
  return filled.replace(new RegExp('\\n{3,}', 'g'), '\n\n').trim();
}

function templateKeyForStatus(status: string) {
  return `sms_tpl_${status.toLowerCase().replace(/\s+/g, '_')}`;
}

export function buildStatusSmsMessage(params: {
  orderId: number;
  status: OrderStatus | string;
  serviceType?: ServiceType | string;
  trackingCode?: string | number;
  trackingUrl?: string;
  clientName?: string;
  storeName?: string;
  etaMin?: number;
}) {
  const cfg = getConfigCache();
  const { orderId, status, serviceType, trackingCode, trackingUrl, clientName, storeName, etaMin } = params;

  const tienda = String(storeName || cfg.nombre_tienda || 'Pizzería');
  const nombre = (clientName || '').trim();

  const saludoCfg = (cfg.sms_saludo || '').toString().trim();
  const firmaCfg = (cfg.sms_firma || '').toString().trim();

  const saludo = saludoCfg
    ? renderTemplate(saludoCfg, { cliente: nombre || 'cliente', tienda })
    : (nombre ? `Hola ${nombre} 👋` : '¡Hola! 👋');

  const eta = etaMin ? `
⏱️ Tiempo aprox: ${etaMin} min.` : '';
  const trackLine = trackingCode
    ? `
🔎 Seguimiento: ${trackingCode}`
    : (trackingUrl ? `
🔎 Seguimiento: ${trackingUrl}` : '');

  const isPickup = !!serviceType && serviceType !== 'Delivery';

  const defaults: Record<string, string> = {
    'pendiente': `${saludo}

✅ Recibimos tu pedido #${orderId}. Ya lo estamos preparando.${eta}${trackLine}

🍕 ${tienda}`,
    'horno': `${saludo}

🔥 Tu pedido #${orderId} ya está en preparación.${eta}${trackLine}

🍕 ${tienda}`,
    'listo': isPickup
      ? `${saludo}

🎉 Tu pedido #${orderId} está LISTO para recojo.${trackLine}

🍕 ${tienda}`
      : `${saludo}

🎉 Tu pedido #${orderId} está LISTO. En breve sale a reparto.${trackLine}

🍕 ${tienda}`,
    'en_transporte': `${saludo}

🛵 Tu pedido #${orderId} va en camino.${trackLine}

🍕 ${tienda}`,
    'entregado': `${saludo}

✅ Pedido #${orderId} entregado. ¡Gracias por elegirnos!${trackLine}

🍕 ${tienda}`,
  };

  const statusKey = String(status).toLowerCase().replace(/\s+/g, '_');
  const customTpl = (cfg[templateKeyForStatus(String(status))] || '').toString().trim();

  const base = customTpl || defaults[statusKey] || `${saludo}

📌 Pedido #${orderId} actualizado: ${status}.${trackLine}

🍕 ${tienda}`;

  const msg = renderTemplate(base, {
    cliente: nombre,
    tienda,
    pedido: orderId,
    estado: String(status),
    track: trackingCode || trackingUrl || '',
  });

  const firma = firmaCfg ? `

${renderTemplate(firmaCfg, { tienda })}` : '';
  return (msg + firma).trim();
}

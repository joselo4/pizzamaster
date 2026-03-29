export type UnifiedPromotionLike = {
  active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
};

type ConfigLike = Record<string, unknown>;

function getText(config: ConfigLike, ...keys: string[]) {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function getNumber(config: ConfigLike, ...keys: string[]) {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
}

export function isWithinSchedule(now: Date, openAt: string, closeAt: string) {
  if (!openAt || !closeAt) return true;
  const [openHour, openMinute = '0'] = openAt.split(':');
  const [closeHour, closeMinute = '0'] = closeAt.split(':');
  const current = now.getHours() * 60 + now.getMinutes();
  const open = Number(openHour) * 60 + Number(openMinute);
  const close = Number(closeHour) * 60 + Number(closeMinute);
  if (Number.isNaN(open) || Number.isNaN(close)) return true;
  if (close >= open) return current >= open && current <= close;
  return current >= open || current <= close;
}

export function resolveOrderAvailability(config: ConfigLike, now: Date) {
  const isEnabled = ['pedido_enabled', 'pedidos_enabled', 'orders_enabled'].some((key) => config[key] === true || config[key] === 'true')
    || config['pedido_enabled'] == null;
  const openAt = getText(config, 'store_open_at', 'pedido_open_at');
  const closeAt = getText(config, 'store_close_at', 'pedido_close_at');
  const scheduleOpen = isWithinSchedule(now, openAt, closeAt);
  const open = isEnabled && scheduleOpen;
  const message = open
    ? getText(config, 'pedido_success_message', 'pedido_message') || 'Pedidos habilitados.'
    : getText(config, 'pedido_disabled_message', 'pedido_message') || 'Pedidos temporalmente cerrados. Revisa el horario o usa el contacto directo.';
  return { open, isEnabled, scheduleOpen, openAt, closeAt, message };
}

export function resolveDeliveryPolicy(config: ConfigLike, subtotal: number) {
  const minAmount = getNumber(config, 'delivery_min_amount', 'pedido_min_amount');
  const baseFee = getNumber(config, 'costo_delivery', 'delivery_fee', 'pedido_costo_delivery', 'pedido_delivery_fee');
  const freeFrom = getNumber(config, 'delivery_free_from', 'delivery_gratis', 'pedido_delivery_gratis', 'free_delivery');
  const effectiveFee = freeFrom > 0 && subtotal >= freeFrom ? 0 : baseFee;
  return { minAmount, baseFee, freeFrom, effectiveFee, qualifies: subtotal >= minAmount };
}

export function resolveFeaturedPromotion<T extends UnifiedPromotionLike>(promotions: T[], now: Date) {
  const active = promotions.filter((item) => item.active !== false).filter((item) => {
    const starts = item.starts_at ? new Date(item.starts_at) : null;
    const ends = item.ends_at ? new Date(item.ends_at) : null;
    if (starts && starts > now) return false;
    if (ends && ends < now) return false;
    return true;
  });
  return active[0] || promotions[0] || null;
}

export function resolveCampaignAttribution(ref: string | null | undefined, promoCode: string | null | undefined) {
  return {
    channel: ref ? 'campaign' : promoCode ? 'promo-code' : 'organic',
    ref: ref || null,
    promoCode: promoCode || null,
  };
}

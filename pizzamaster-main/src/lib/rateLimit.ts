
const KEY_PREFIX = 'pizza_customer_last_request_';

export function canSendRequest(phone: string, cooldownMs: number = 90_000) {
  const k = `${KEY_PREFIX}${phone.replace(/\D/g,'')}`;
  const last = Number(localStorage.getItem(k) || '0');
  const now = Date.now();
  const remaining = Math.max(0, cooldownMs - (now - last));
  return { ok: remaining === 0, remainingMs: remaining };
}

export function markSent(phone: string) {
  const k = `${KEY_PREFIX}${phone.replace(/\D/g,'')}`;
  localStorage.setItem(k, String(Date.now()));
}


export const STORE_WA_NUMBER = '51989466466'; // +51 989 466 466

export function buildWhatsAppLink(message: string, phone: string = STORE_WA_NUMBER) {
  const clean = phone.replace(/\D/g, '');
  const text = encodeURIComponent(message);
  return `https://wa.me/${clean}?text=${text}`;
}

export function openWhatsApp(message: string, phone: string = STORE_WA_NUMBER) {
  const url = buildWhatsAppLink(message, phone);
  window.open(url, '_blank', 'noopener,noreferrer');
}

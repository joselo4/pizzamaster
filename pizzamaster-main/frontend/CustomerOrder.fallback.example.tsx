
// CustomerOrder.fallback.example.tsx
// Lectura con fallbacks para CTAs globales (usa tus helpers reales: getText, cfg, etc.)

const storePhone =
  getText('store_phone')
  ?? getText('pedido_contact_phone')
  ?? getText('pedido_phone')
  ?? '';

const storeWa =
  getText('store_wa')
  ?? getText('pedido_contact_wa')
  ?? getText('pedido_wa')
  ?? '';

// Usa storePhone/storeWa en tus botones Llamar / WhatsApp.

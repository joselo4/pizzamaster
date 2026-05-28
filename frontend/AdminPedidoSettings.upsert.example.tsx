
// AdminPedidoSettings.upsert.example.tsx
// Upsert de claves canónicas en text_value (ajusta a tu util upsertConfig)

await upsertConfig([
  { key: 'store_phone', text_value: storePhone.trim() },
  { key: 'store_wa',    text_value: storeWa.trim()    },
  // ...mantén aquí tus otras claves (pedido_enabled, pedido_message, etc.)
]);

# Plan de consolidación recomendado

1. Reemplazar lecturas directas de config por `useStoreConfig` en pedido, promos, admin y settings.
2. Llevar las pantallas `/promo`, `/promos` y admin/promos a `useUnifiedPromotions`.
3. Enviar SMS/WhatsApp/Telegram a través del `notificationCenter` + `telemetry`.
4. Reutilizar los componentes base (`MetricCard`, `SectionCard`, `SectionHeader`, `EmptyState`) en reportes y CRUD.
5. Eliminar gradualmente helpers legacy de permisos cuando todas las pantallas lean desde `usePermissionMatrix`.

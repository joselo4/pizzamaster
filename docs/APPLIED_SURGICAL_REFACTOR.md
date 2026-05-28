
# Refactor quirúrgico aplicado

## Simplificaciones incluidas
- **Permisos centralizados**: se agregó `usePermissionMatrix` para exponer una única lectura efectiva.
- **Configuración global**: se incorporó `StoreConfigProvider` + `useStoreConfig` como punto único para config de tienda/pedido/delivery.
- **Telemetría/operación**: se consolidó la capa de monitoreo operacional con `opsAutomation` y un dashboard ejecutivo unificado.
- **CRUD/UI base**: se crearon componentes base (`MetricCard`, `SectionCard`, `SectionHeader`, `EmptyState`) para reducir UI repetida.
- **Scripts**: se estandarizaron `bootstrap` y `preflight:security` para instalación y revisión técnica.
- **Seguridad**: se sanitizó `.env` y se añadió `.env.local.example`.

## Implementaciones nuevas
- **Dashboard ejecutivo** (`src/pages/AdminDashboard.tsx`).
- **Hooks reutilizables** para métricas, promociones, permisos y configuración.
- **Motor de reglas** (`businessRules.ts`) para horario, delivery y promo destacada.
- **Centro de notificaciones** (`notificationCenter.ts`) con historial local para unificación futura.
- **Automatización operativa** (`opsAutomation.ts`) y SQL base para mantenimiento.

## Alcance quirúrgico
Este refactor evita reescribir pantallas legacy de forma masiva. Se añadió una capa segura y progresiva para que el resto del proyecto pueda migrar sin romper la operación actual.

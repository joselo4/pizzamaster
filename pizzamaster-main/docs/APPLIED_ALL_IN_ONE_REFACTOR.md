# Refactor all-in-one aplicado

## Qué se aplicó
- **Simplificación de promociones** con `useUnifiedPromotions` como capa progresiva entre DB y config.
- **Centralización de configuración** con `StoreConfigProvider` y `useStoreConfig`.
- **Mejora de permisos** con `usePermissionMatrix` para consumo consistente en UI.
- **Dashboard ejecutivo nuevo** (`src/pages/AdminDashboard.tsx`) con métricas, configuración, promos, permisos, seguridad y automatización.
- **Centro de notificaciones** (`notificationCenter.ts`) para concentrar historial local y preparar integración SMS/WhatsApp/Dashboard.
- **Reglas de negocio** (`businessRules.ts`) para horarios, delivery y promos destacadas.
- **Automatización operativa** (`opsAutomation.ts`) y SQL sugerido para mantenimiento.
- **Hardening de Supabase**: fallback seguro si el entorno no está configurado, compatibilidad entre `VITE_SUPABASE_KEY` y `VITE_SUPABASE_ANON_KEY`, y banner visible de configuración.
- **Scripts de bootstrap y preflight** para instalación y validación del entorno.

## Importante
El ZIP ya no redistribuye credenciales reales. Debes completar `.env.local` con tu URL real de Supabase y tu anon key real para cargar datos remotos.

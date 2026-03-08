REV16 (quirúrgico) – Salud del sistema: Errores + Auditoría funcionando en Electron

Problema:
- Salud del sistema mostraba “Sin errores” y “Sin registros” aunque existían fallas operativas.

Fix aplicado (Frontend):
1) Errores controlados: notifyError() ahora también registra en public.client_errors.
2) Errores globales: window.error y unhandledrejection registran en public.client_errors.
3) Auditoría automática: cada operación de escritura (POST/PATCH/PUT/DELETE) a Supabase REST (/rest/v1/*)
   registra un evento en public.audit_logs con action y details.
4) Nota obligatoria (quirúrgico): se exige observation (mín. 5 caracteres) para movimientos OUT y AJUSTE.

Requisitos BD (Supabase):
- Tablas public.client_errors y public.audit_logs existentes.
- Policies/Grants: INSERT y SELECT para authenticated (client_errors permite INSERT también a anon).

Electron DEV:
  npm install
  npm run dev:electron

Build instalador:
  npm run dist:electron

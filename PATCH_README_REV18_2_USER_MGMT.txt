REV18.2 – Usuarios: fix full_name/schema cache + Suspender/Reactivar + rol fallback seguro + UI permisos mejorada + inputs sin null

1) Supabase (SQL Editor) – ejecutar:
   pca-main/supabase/migrations/20260202_profiles_fullname_status.sql

2) Si el API no refleja cambios:
   select pg_notify('pgrst','reload schema');
   y/o Dashboard → Settings → API → Restart API

3) Frontend:
   - AuthContext ahora lee role+status y bloquea acceso si status=SUSPENDED/BLOCKED.
   - Fallback de rol: viewer (ya no aparece ASSISTANT).
   - UsersManager: 
     * Normaliza email/full_name antes de guardar (sin nulls)
     * Inputs controlados sin value=null
     * Botón Suspender/Reactivar
     * Permisos avanzados agrupados + Reset + notifyError

Build:
   npm install
   npm run dev
   npm run dev:electron

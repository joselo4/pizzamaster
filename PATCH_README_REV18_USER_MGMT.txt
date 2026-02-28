REV18 – Usuarios: fix full_name/schema cache + Suspender/Reactivar + rol fallback seguro + UI permisos mejorada

1) Supabase (SQL Editor) – ejecutar:
   supabase/migrations/20260202_profiles_fullname_status.sql

2) Si el API no refleja cambios:
   select pg_notify('pgrst','reload schema');
   y/o Dashboard → Settings → API → Restart API

3) Frontend:
   - AuthContext ahora lee role+status y bloquea acceso si status=SUSPENDED/BLOCKED.
   - Fallback de rol: viewer (ya no aparece ASSISTANT).
   - UsersManager: muestra estado, botón Suspender/Reactivar y mejora UI de permisos avanzados.

Build:
   npm install
   npm run dev
   npm run dev:electron

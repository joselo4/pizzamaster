
# Edge Functions (Supabase)

## admin-delete-user
Eliminación real del usuario (Auth + profiles). **No** se puede hacer con la clave ANON desde el cliente.

### Deploy (CLI)
- Instalar Supabase CLI
- Enlazar proyecto
- Deploy:
  supabase functions deploy admin-delete-user

### Variables requeridas (Project Settings → Edge Functions)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

> Nota: la SERVICE_ROLE_KEY nunca debe ir en el frontend.

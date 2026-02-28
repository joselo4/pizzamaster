# Supabase RLS (Producción)

## 1) Ejecutar políticas RLS
1. Abrir **Supabase → SQL Editor**
2. Pegar y ejecutar el archivo: `supabase/rls_policies.sql`

Esto habilita RLS y crea políticas por rol:
- **VIEWER**: solo lectura
- **OPERATOR**: lectura + escritura operativa (excepto avisos)
- **ADMIN**: todo

## 2) Importante
- Los roles se leen desde `public.profiles.role`.
- Asegúrese de que cada usuario tenga registro en `profiles`.

## 3) Avisos
- Los avisos se guardan en `app_settings` con key `avisos_*`.
- Solo ADMIN puede modificarlos (política bloquea a OPERATOR).

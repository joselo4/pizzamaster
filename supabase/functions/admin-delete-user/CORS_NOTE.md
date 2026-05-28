
# CORS fix (admin-delete-user)

- Added CORS preflight handling (OPTIONS) and CORS headers on all responses.
- No changes to auth/role checks.

## Local secrets
For local dev, create: `supabase/functions/.env` with:
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```
Then run `supabase functions serve admin-delete-user`.

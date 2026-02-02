
# Nota sobre errores en VS Code (Deno)

Los archivos dentro de `supabase/functions/*` se ejecutan con **Deno** (Edge Functions). 
Si VS Code no está configurado para Deno, verás errores como:
- "Cannot find name 'Deno'"
- "Cannot find module https://deno.land/..."

## Solución rápida
1) Instala la extensión **Deno** en VS Code.
2) En `.vscode/settings.json` agrega:

```json
{
  "deno.enable": true,
  "deno.unstable": true,
  "deno.lint": true,
  "deno.config": "./supabase/functions/deno.json",
  "deno.enablePaths": ["./supabase/functions"]
}
```

3) Reinicia VS Code.

> Esto solo afecta al editor. `npm run dev` no compila los archivos de `supabase/functions`.


#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  echo "Uso: bash scripts/apply_to_project.sh /ruta/a/tu/proyecto" >&2
  exit 1
fi
if [[ ! -d "$ROOT/src" ]]; then
  echo "No encuentro $ROOT/src. ¿Apuntaste al root del proyecto?" >&2
  exit 1
fi
mkdir -p "$ROOT/public/promos/social" "$ROOT/supabase_sql"
cp -f public/promos/*.svg "$ROOT/public/promos/" || true
cp -f public/promos/social/*.svg "$ROOT/public/promos/social/" || true
cp -f supabase_sql/22_promotions_variants_upsert.sql "$ROOT/supabase_sql/" 
cp -f promos_config.json "$ROOT/promos_config.json" 

echo "✅ Copiado. Ahora ejecuta en Supabase SQL Editor: supabase_sql/22_promotions_variants_upsert.sql"

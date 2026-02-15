
#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  echo "Uso: bash scripts/apply.sh /ruta/a/tu/proyecto" >&2
  exit 1
fi
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/public/promos" "$ROOT/supabase_sql"
cp -rf "$SRC_DIR/public/promos/"* "$ROOT/public/promos/" || true
cp -f "$SRC_DIR/supabase_sql/99_fix_promos_admin_v3_FIXED.sql" "$ROOT/supabase_sql/" 

echo "✅ Copiado. Ejecuta en Supabase: supabase_sql/99_fix_promos_admin_v3_FIXED.sql"

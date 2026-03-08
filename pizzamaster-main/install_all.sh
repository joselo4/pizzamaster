#!/usr/bin/env bash
set -euo pipefail

# === Instalador quirúrgico (campaña CARLOS + multi-promos + remove Soy operador) ===
# Uso:
#   bash install_all.sh /ruta/a/pizzamaster-main

ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  echo "Uso: bash install_all.sh /ruta/a/pizzamaster-main" >&2
  exit 1
fi

if [[ ! -d "$ROOT/src" ]]; then
  echo "No encuentro $ROOT/src. ¿Apuntaste al root del proyecto?" >&2
  exit 1
fi

# Copiar nuevos archivos
copy_file(){
  local src="$1"; local dst="$2";
  mkdir -p "$(dirname "$dst")"
  cp -f "$src" "$dst"
}

# 1) Assets
copy_file "./public/campaigns/carlos_poster_bw.svg" "$ROOT/public/campaigns/carlos_poster_bw.svg"
copy_file "./public/campaigns/carlos_poster_bw.html" "$ROOT/public/campaigns/carlos_poster_bw.html"
copy_file "./public/promos/promo_placeholder_1.svg" "$ROOT/public/promos/promo_placeholder_1.svg"
copy_file "./public/promos/promo_placeholder_2.svg" "$ROOT/public/promos/promo_placeholder_2.svg"

# 2) Nuevos módulos/pages
copy_file "./src/lib/promos.ts" "$ROOT/src/lib/promos.ts"
copy_file "./src/pages/Promos.tsx" "$ROOT/src/pages/Promos.tsx"
copy_file "./src/pages/PromoShow.tsx" "$ROOT/src/pages/PromoShow.tsx"
copy_file "./src/pages/AdminPromos.tsx" "$ROOT/src/pages/AdminPromos.tsx"

# 3) SQL
copy_file "./supabase_sql/18_promotions_schema.sql" "$ROOT/supabase_sql/18_promotions_schema.sql"
copy_file "./supabase_sql/19_promotions_policies.sql" "$ROOT/supabase_sql/19_promotions_policies.sql"
copy_file "./supabase_sql/20_promotions_seed.sql" "$ROOT/supabase_sql/20_promotions_seed.sql"

PROMO="$ROOT/src/pages/Promo.tsx"
CUST="$ROOT/src/pages/CustomerOrder.tsx"
APP="$ROOT/src/App.tsx"
ADMIN="$ROOT/src/pages/admin.tsx"

# Backup
for f in "$PROMO" "$CUST" "$APP" "$ADMIN"; do
  if [[ -f "$f" ]]; then
    cp -f "$f" "$f.bak"
  fi
done

# 4) Parche /promo (campaña CARLOS) manteniendo cfg
python3 - "$PROMO" <<'PY'
import sys, re, pathlib
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding='utf-8', errors='ignore')

# defaults
def sub(pat, rep):
  global text
  text, _ = re.subn(pat, rep, text)

sub(r"const\s+badge\s*=\s*cfg\?\.promo_badge\s*\|\|\s*'[^']*';", "const badge = cfg?.promo_badge || 'CHISME REAL. PROMO REAL.';")
sub(r"const\s+titleA\s*=\s*cfg\?\.promo_headline\s*\|\|\s*'[^']*';", "const titleA = cfg?.promo_headline || '¡CARLOS TE ENGAÑA! 💔';")
sub(r"const\s+titleB\s*=\s*cfg\?\.promo_subheadline\s*\|\|\s*'[^']*';", "const titleB = cfg?.promo_subheadline || '...Dijo que él invitaba la cena hoy y se hizo humo.';")
sub(r"const\s+body\s*=\s*cfg\?\.promo_body\s*\|\|\s*'[^']*';", "const body = cfg?.promo_body || 'No dejes que te rompan el corazón (ni el estómago). Consuélate con nuestra masa fina y crujiente de 16 cm.';")
sub(r"const\s+ctaLabel\s*=\s*cfg\?\.promo_cta_label\s*\|\|\s*'[^']*';", "const ctaLabel = cfg?.promo_cta_label || 'PEDIR MI PIZZA AHORA';")
sub(r"const\s+waMsg\s*=\s*cfg\?\.promo_wa_message\s*\|\|\s*'[^']*';", "const waMsg = cfg?.promo_wa_message || 'Hola 👋 Quiero la promo CARLOS (S/10: pizza personal + chicha). ¿Me ayudas a pedir?';")

# benefit copy swaps (si existen)
repls = [
 ('Hecha al momento','¡Lista en 8 minutos!'),
 ('(masa fresca + queso full)','(Más rápido que las excusas de Carlos).'),
 ('Delivery gratis','La personal perfecta (16cm).'),
 ('(hoy)','Ni muy grande, ni muy chica. Tuya.'),
 ('Sabor brutal','Masa extra fina y crujiente.'),
 ('(la dieta no se salva)','El verdadero "crunch".'),
]
for a,b in repls:
  text = text.replace(a,b)

# ensure menu link below benefit section
if 'Mira todo el menú' not in text:
  marker = '</div>\n\n      <div className="mt-6 grid'
  if marker in text:
    text = text.replace(marker, '</div>\n\n      <div className="mt-4 text-center">\n        <Link to="/pedido" className="underline text-white/80 hover:text-white">¿No quieres pepperoni? Mira todo el menú.</Link>\n      </div>\n\n      <div className="mt-6 grid')

p.write_text(text, encoding='utf-8')
PY

# 5) Quitar botón Soy operador
python3 - "$CUST" <<'PY'
import sys, re, pathlib
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding='utf-8', errors='ignore')
pat = re.compile(r"\s*<button[^>]*navigate\((?:'|\")/login(?:'|\")\)[\s\S]*?Soy operador[\s\S]*?</button>\s*", re.IGNORECASE)
text2, n = pat.subn('\n', text)
if n == 0:
  pat2 = re.compile(r"\s*<button[\s\S]*?Soy operador[\s\S]*?</button>\s*", re.IGNORECASE)
  text2, _ = pat2.subn('\n', text)
p.write_text(text2, encoding='utf-8')
PY

# 6) Router: agregar /promos y /promo/:slug sin romper /promo actual
python3 - "$APP" <<'PY'
import sys, pathlib, re
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding='utf-8', errors='ignore')

# add imports if missing
if "./pages/Promos" not in text:
  text = text.replace("import Promo from './pages/Promo';", "import Promo from './pages/Promo';\nimport Promos from './pages/Promos';\nimport PromoShow from './pages/PromoShow';")

# add routes if missing
if 'path="/promos"' not in text:
  text = text.replace('<Route path="/promo" element={<Promo />} />', '<Route path="/promo" element={<Promo />} />\n          <Route path="/promos" element={<Promos />} />\n          <Route path="/promo/:slug" element={<PromoShow />} />')

p.write_text(text, encoding='utf-8')
PY

# 7) Admin: agregar tab "promos" y renderizar AdminPromos (sin tocar tu tab promo legacy)
python3 - "$ADMIN" <<'PY'
import sys, pathlib, re
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding='utf-8', errors='ignore')

if "./AdminPromos" not in text and "AdminPromos" not in text:
  # insert import after other imports
  # heuristic: after lucide import line
  text = re.sub(r"(from 'lucide-react';\n)", r"\1import AdminPromos from './AdminPromos';\n", text, count=1)

# add tab button: look for tab bar occurrence "setTab('promo')" and add promos after
if "setTab('promos')" not in text:
  text = text.replace("setTab('promo')", "setTab('promo')")
  # heuristic insertion near promo button label
  text = text.replace(">promo<", ">promo<")

# render: insert before closing of main render switch area
if "tab === 'promos'" not in text:
  # place near existing promo tab render
  text = text.replace("tab === 'promo'", "tab === 'promo'")
  # crude but safe: add at end of JSX blocks using a marker for promo tab
  marker = "{tab === 'promo'"
  if marker in text:
    # insert right after promo block (best effort): find first occurrence end of promo block by searching next tab condition.
    # We'll just insert another conditional near the promo one.
    text = text.replace(marker, "{tab === 'promos' && (<AdminPromos />)}\n\n      " + marker, 1)

p.write_text(text, encoding='utf-8')
PY

cat <<'EOT'
✅ Instalación completa aplicada.

Siguientes pasos (OBLIGATORIO en Supabase):
1) Ejecuta en SQL Editor:
   - supabase_sql/18_promotions_schema.sql
   - supabase_sql/19_promotions_policies.sql
   - supabase_sql/20_promotions_seed.sql

Luego prueba:
- /promo?ref=carlos (campaña)
- /promos (listado)
- /promo/carlos10 (detalle)
- Admin -> pestaña Promos (CRUD)
EOT

#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-}"
HISTORY_REL="${2:-}"
if [[ -z "$ROOT" ]]; then
  echo "Uso: bash scripts/install_all.sh /ruta/a/proyecto [/ruta/relativa/a/Historial.tsx]" >&2
  exit 1
fi
if [[ ! -d "$ROOT/src" ]]; then
  echo "No encuentro $ROOT/src" >&2
  exit 1
fi

copy(){ mkdir -p "$(dirname "$2")"; cp -f "$1" "$2"; }
backup(){ [[ -f "$1" ]] && cp -f "$1" "$1.bak" || true; }

# 1) Copiar pantalla
copy "$(dirname "$0")/../src/pages/CashierOrderEditor.tsx" "$ROOT/src/pages/CashierOrderEditor.tsx"

# 2) Patch App.tsx (import + ruta)
APP="$ROOT/src/App.tsx"
if [[ -f "$APP" ]]; then
  backup "$APP"
  python3 - "$APP" <<'PY'
import sys, re, pathlib
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding='utf-8', errors='ignore')

# Import
if "import CashierOrderEditor from './pages/CashierOrderEditor';" not in text:
  # insertar después del último import
  lines = text.splitlines()
  last_import = 0
  for i,l in enumerate(lines):
    if l.strip().startswith('import '):
      last_import = i
  lines.insert(last_import+1, "import CashierOrderEditor from './pages/CashierOrderEditor';")
  text = "\n".join(lines)

# Ruta dentro de <Routes>
if 'path="/cashier/history/edit/:id"' not in text:
  # insertar antes de </Routes>
  text = re.sub(r"(</Routes>)", r"  <Route path=\"/cashier/history/edit/:id\" element={<CashierOrderEditor />} />\n\1", text, count=1)

p.write_text(text, encoding='utf-8')
PY
else
  echo "⚠️ No existe $APP; agrega la ruta manualmente." >&2
fi

# 3) Patch Historial (agregar botón)
select_file(){
  local guess
  if [[ -n "$HISTORY_REL" && -f "$ROOT/$HISTORY_REL" ]]; then echo "$ROOT/$HISTORY_REL"; return; fi
  for guess in \
    "$ROOT/src/pages/CashierHistory.tsx" \
    "$ROOT/src/modules/cashier/History.tsx" \
    "$ROOT/src/modules/cashier/CashierHistory.tsx" \
    "$ROOT/src/pages/Cashier/History.tsx"; do
    [[ -f "$guess" ]] && { echo "$guess"; return; }
  done
  # buscar por texto Reimprimir
  python3 - <<'PY'
import os, sys
ROOT=sys.argv[1]
for base,_,files in os.walk(os.path.join(ROOT,'src')):
  for fn in files:
    if fn.endswith('.tsx'):
      p=os.path.join(base,fn)
      try:
        t=open(p,'r',encoding='utf-8',errors='ignore').read()
      except: continue
      if 'Reimprimir' in t:
        print(p)
        sys.exit(0)
print('')
PY
 "$ROOT"
}

HFILE=$(select_file)
if [[ -n "$HFILE" && -f "$HFILE" ]]; then
  backup "$HFILE"
  python3 - "$HFILE" <<'PY'
import sys, re, pathlib
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding='utf-8', errors='ignore')

# ensure import useNavigate
if 'useNavigate' not in text:
  # insert import line or extend existing react-router-dom import
  if "from 'react-router-dom'" in text:
    text = re.sub(r"from 'react-router-dom'\s*;", "from 'react-router-dom';\nimport { useNavigate } from 'react-router-dom';", text, count=1)
  else:
    text = "import { useNavigate } from 'react-router-dom';\n" + text

# ensure const navigate
if 'useNavigate()' not in text:
  # try to insert after function component start
  text = re.sub(r"(export default function [^{]+\{)", r"\1\n  const navigate = useNavigate();", text, count=1)
  if 'useNavigate()' not in text:
    text = re.sub(r"(function [^{]+\{)", r"\1\n  const navigate = useNavigate();", text, count=1)

btn = """
<button
  className=\"inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700\"
  onClick={() => navigate(`/cashier/history/edit/${o.id}`)}
>
  Editar
</button>
"""

if 'navigate(`/cashier/history/edit/${o.id}`)' not in text:
  # try to place after Reimprimir button
  text = re.sub(r"(Reimprimir\s*</button>)", r"\1\n"+btn, text, count=1)
  
  # if not placed, try inside actions container
  if 'navigate(`/cashier/history/edit/${o.id}`)' not in text:
    text = re.sub(r"(<div className=\"flex items-center[^>]*\">)", r"\1\n"+btn, text, count=1)

p.write_text(text, encoding='utf-8')
PY
  echo "✅ Botón Editar inyectado en: $HFILE"
else
  echo "⚠️ No se encontró automáticamente el archivo de Historial. Pásalo como 2do parámetro." >&2
fi

echo "\nListo. Revisa backups .bak y corre: npm run dev" 

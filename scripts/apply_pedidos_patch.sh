
#!/usr/bin/env bash
set -euo pipefail

# Archivos objetivo (ajusta según tu repo)
FILES=(
  "src/pages/POS.tsx"
  "src/pages/CustomerOrder.tsx"
  "src/pages/pedido/Pedido.tsx"
)

# 1) Quitar utilidades que generan elipsis
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    # quitar truncate / text-ellipsis
    sed -i.bak -E 's/\b(truncate|text-ellipsis)\b//g' "$f"
    # quitar line-clamp-<n>
    sed -i.bak -E 's/\bline-clamp-[0-9]+\b//g' "$f"
    # compactar espacios redundantes en className
    sed -i.bak -E 's/className="([^"]*)"/className="\1"/g' "$f"
    sed -i.bak -E 's/  +/ /g' "$f"
  fi
done

# 2) Agregar utilidades para envolver texto
# Añadimos sólo si la línea contiene {item.name} o {product.name} o {name}
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    # Inserta las clases tras font-medium si existe; si no, tras text-*
    perl -0777 -pe 's/(className="[^"]*font-medium)([^"]*"[^
]*\{(item|product)\.name\}|[^"]*"[^
]*\{name\})([^
]*)
/ whitespace-normal break-words max-w-full leading-snug
/g' -i "$f"
    perl -0777 -pe 's/(className="[^"]*text-[a-z0-9\[\]\.]+)([^"]*"[^
]*\{(item|product)\.name\}|[^"]*"[^
]*\{name\})([^
]*)
/ whitespace-normal break-words max-w-full leading-snug
/g' -i "$f"
  fi
done

echo "✅ Parche aplicado. Revisa cambios con 'git diff' y prueba la app."

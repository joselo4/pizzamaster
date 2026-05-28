
# Parche integral: nombres completos en /pedidos (sin elipsis)

Este paquete aplica un cambio **quirúrgico** para que los nombres de productos se muestren **completos** (sin `…`) en las pantallas de pedidos.

## ¿Qué hace?
1) **Elimina** utilidades que generan elipsis (`truncate`, `text-ellipsis`, `line-clamp-*`).
2) **Agrega** utilidades seguras para envolver texto: `whitespace-normal break-words max-w-full leading-snug`.
3) Incluye **diffs de ejemplo** para `POS.tsx` y `CustomerOrder.tsx` y un **script opcional** para aplicar el cambio de forma masiva (sólo en esas pantallas).
4) Añade una clase CSS opcional (`.no-ellipsis`) por si prefieres usar una sola clase en el JSX.

> El proyecto usa React + Tailwind y ya tiene Tailwind configurado, por eso estas utilidades funcionarán sin cambios. 

## Contenido
- `scripts/apply_pedidos_patch.sh` → script (macOS/Linux) que elimina `truncate` y `line-clamp-*` en archivos clave de `/pedidos` y añade las utilidades recomendadas.
- `styles/no_ellipsis.css` → clase utilitaria opcional.
- `examples/pos_name_patch.diff` → diff de ejemplo para un `h3` con nombre del ítem.
- `examples/customerorder_name_patch.diff` → diff de ejemplo equivalente.

## Uso rápido (recomendado)
1. Copia **todo** a la raíz de tu repo.
2. Revisa y ajusta las rutas en `scripts/apply_pedidos_patch.sh` si tus archivos tienen otros nombres o ubicaciones.
3. Da permisos y ejecuta:
   ```bash
   chmod +x scripts/apply_pedidos_patch.sh
   ./scripts/apply_pedidos_patch.sh
   ```
4. Arranca tu app y verifica `/pedido` o `/pos`.

## Plan B: Clase CSS única
1. Importa `styles/no_ellipsis.css` en tu `src/index.css` o directamente en el componente.
2. Reemplaza `truncate`/`line-clamp-*` por `no-ellipsis` en el elemento del nombre.

## Nota
- El cambio sólo ajusta estilos; **no** toca lógica de negocio.
- Si ves que botones/badges a la derecha comprimen el texto, agrega `shrink-0` a esos contenedores.

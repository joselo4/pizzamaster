REV20.7_STABLE_PATCHED12 – Fix TSX escape + Preset Matricial (cinta)

Fix
- PecosaBook.tsx: se corrigió JSX inválido (className="...") que rompía el build con Babel.

Mejora Matricial
- Defaults de impresión PECOSA optimizados para impresora matricial:
  Courier + Bold, tamaños mayores (18/14/12/11), lineWidth 0.9.

Notas
- En el visor PDF (Adobe/Foxit): imprimir en 'Tamaño real' / 'Sin escalado'.

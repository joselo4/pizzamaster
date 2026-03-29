# Revisión del refactor v4

## ¿Aplicó todo lo prometido el refactor anterior?
No del todo.

### Lo que sí había quedado bien
- Hardening inicial de Supabase.
- Contexto global de configuración.
- Hooks reutilizables para métricas, promos y permisos.
- Dashboard administrativo moderno.

### Lo que estaba incompleto
- `/promos` todavía redirigía a `/promo`, así que no existía un catálogo propio realmente más usable.
- La experiencia pública seguía mezclando dos conceptos: landing y catálogo.
- No había una mejora visual transversal suficiente para que la app se sintiera más intuitiva.
- El refactor no guiaba al usuario final cuando el entorno no estaba configurado.

## Qué corrige esta v4
- `/promo` ahora es una landing clara y enfocada.
- `/promos` ahora sí es un catálogo independiente con búsqueda.
- Se agrega `PageShell` para una jerarquía visual más consistente.
- Se añade `OrderQuickGuide` para dejar listo el siguiente paso de UX en /pedido.
- Se documenta de forma explícita qué se corrigió y qué queda por consolidar.

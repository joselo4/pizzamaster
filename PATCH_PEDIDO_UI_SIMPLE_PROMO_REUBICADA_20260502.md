# PATCH PEDIDO UI SIMPLE + PROMO REUBICADA 2026-05-02

## Objetivo
Simplificar visualmente la pantalla `/pedido` para que completar el pedido sea más rápido en móvil y PC.

## Cambios aplicados
- Se eliminó el chip superior: `Pedido premium • fácil de terminar`.
- Se cambió el titular de `/pedido` a: `Pide rápido y confirma en minutos`.
- Se simplificó el texto descriptivo del hero para reducir altura y carga visual.
- Se reubicó el acceso a `/promo` antes del hero, como CTA compacto y visible: `🔥 Ver promociones`.
- Se eliminó el CTA grande de promociones dentro del hero para evitar que alargue la pantalla inicial.
- Se redujo ligeramente el radio/padding del hero en móvil.
- Se agregó `z-40` a la barra fija inferior para mantenerla estable sobre el contenido.

## Archivo modificado
- `src/pages/CustomerOrder.tsx`

## Ruta afectada
- `/pedido`
- `/pedidos` mantiene su lógica, con textos más compactos donde comparte componente.

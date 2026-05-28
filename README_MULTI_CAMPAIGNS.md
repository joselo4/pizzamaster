# Multi-campañas de Promo (quirúrgico)

## Fix UI incluido
- Modal de "Gestionar campañas" ahora fuerza texto oscuro (`text-gray-900`) para que se vea bien sobre fondo blanco.
- Se corrigió la sección "Promociones" en /promo: si hay campañas activas, se mapean a tarjetas para evitar que salgan vacías.

## SQL (Supabase)
1) Ejecuta `sql/13_promo_events.sql` (tracking)
2) Opcional: `sql/12_promo_promos_seed.sql` (carga campañas modernas + Carlos)

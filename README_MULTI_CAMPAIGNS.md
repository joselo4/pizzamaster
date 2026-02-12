# Multi-campañas de Promo (quirúrgico)

## Fix UI incluido
- Modal de "Gestionar campañas" ahora fuerza texto oscuro (`text-gray-900`) para que se vea bien sobre fondo blanco.
- Se corrigió la sección "Promociones" en /promo: si hay campañas activas, se mapean a tarjetas para evitar que salgan vacías.

## SQL (Supabase)
1) Ejecuta `sql/13_promo_events.sql` (tracking)
2) Opcional: `sql/12_promo_promos_seed.sql` (carga campañas modernas + Carlos)


## Importante (para que se vean en /promo sin login)
1) Ejecuta `supabase_sql/10_promo_public_read_policy.sql` (habilita lectura pública de `promo_promos`).
2) Ejecuta `supabase_sql/21_seed_promo_promos_seed.sql` (carga campañas en `promo_promos`).
> Si no haces esto, /promo puede mostrar sólo defaults aunque tengas promos en DB.

# Pizzería – Build Limpio

Este paquete contiene solo el módulo de *pizzería/promos/pedido* extraído del ZIP original.

## Rutas
- /promo (landing QR)
- /promos (catálogo desde DB)
- /pedido (flujo cliente)
- /admin → pestaña **Promos** (si está presente AdminPromos)

## Requisitos
1) Node 20 LTS (recomendado)
2) Supabase con RLS habilitado
3) Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

## Migraciones (Promos)
Ejecutar en Supabase → SQL Editor, en orden:

1) supabase_sql/18_promotions_schema.sql
2) supabase_sql/19_promotions_policies.sql
3) supabase_sql/20_promotions_seed.sql

Luego: `select pg_notify('pgrst','reload schema');` si el API no refleja cambios.

## Correr en local
```bash
npm install
npm run dev
```

---
Este ZIP fue generado automáticamente desde main(3).zip conservando solo archivos de pizzería.

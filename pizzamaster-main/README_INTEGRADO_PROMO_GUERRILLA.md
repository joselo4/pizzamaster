# Parche INTEGRADO: Promo Guerrilla (Carlos) + UX Conversion + Parches existentes

## Qué incluye (quirúrgico)
1) **/promo** optimizada para QR: chisme → risa → antojo → compra.
2) **Elimina** el botón **"Soy operador"** del flujo cliente.
3) **Promos múltiples** editables desde **Admin → Promo** (`promo_promos`).
4) Integra los parches existentes:
   - Tracking público sin PII + botón **Actualizar** (RPC `rpc_track_order`).
   - Validación: botón **Ticket** (imprime PDF).

## Supabase (obligatorio)
Ejecuta en este orden:
- `sql/rls_policies.sql`
- `sql/tracking_index.sql`
- `sql/tracking_rpc.sql`
- `sql/promo_public_read_policy.sql`
- `supabase_sql/14_seed_promo_keys_text_value.sql` (o tu equivalente)

> Si ya tienes policies equivalentes, estos scripts agregan policies específicas sin romper las existentes.

## Cómo editar promos (vendedoras)
En **Admin → pestaña Promo**:
- Edita titulares/CTA/WhatsApp.
- Pega un JSON en `promo_promos` (lista de promos con tag/title/price/note/promo/bullets).

## Hosting
Para que `/promo` funcione por URL directa en producción (React Router), configura rewrite a `/index.html`.

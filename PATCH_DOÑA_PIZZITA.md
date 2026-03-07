# Patch quirúrgico – Branding + Backup/Restore + Wipe (2026-03-06)

## Branding
- Nuevo componente: `src/components/StoreBrandBar.tsx`
- Se muestra **logo + nombre + slogan** en:
  - `/promo` (tono oscuro)
  - `/promos` (tono claro)
  - `/pedido` y `/pedidos` (tono claro)

## Config
- Nueva key: `store_slogan` (text_value)
- Editable desde: `AdminPedidoSettings`
- Lectura pública habilitada (RLS) en: `supabase_sql/11_identity_public_read_policy.sql`

## Backup / Restore / Wipe
- Ya existente en: `src/modules/settings/components/SystemSettings.tsx`
  - `downloadBackupFullDb` (descarga .xlsx)
  - `restoreBackupFullDb` (restaura .xlsx)
  - `wipeAllData` (elimina datos operativos)

## Post-deploy
Si el API no refleja cambios de policy:
```sql
select pg_notify('pgrst','reload schema');
```

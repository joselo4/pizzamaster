
# Operación

## Opción B: Centralizar PANTBC en `patients`
1) Ejecuta `supabase/migrations/20260125_create_patients_pantbc.sql` en el SQL Editor.
2) Reinicia la app.

## Flags
Configurar en Configuración → Flags.

## Libro PECOSAS / Cierre / Salud
Rutas:
- /pecosas
- /closure
- /health

## ¿Dónde se registra la entrega/PECOSA en tu BD?
Ejecuta en Supabase:

```sql
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and column_name ilike '%pecosa%'
order by table_name, column_name;
```

Y para movimientos de entrega:
```sql
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and column_name in ('product_id','quantity','patient_id','center_id','status','justification')
order by table_name, column_name;
```


# Entregas PANTBC (MVP)

## 1) Crear tablas
Ejecuta en Supabase:
- supabase/migrations/20260125_create_pantbc_deliveries.sql

Incluye:
- 1 entrega por paciente por mes/año (status <> 'ANULADO')
- bloqueo a pacientes INACTIVO
- anulación con motivo obligatorio

## 2) Uso
Menú: Entregas PANTBC
- Nueva entrega: seleccionar paciente ACTIVO + kit + fecha.
- Anular: requiere motivo (>=10 caracteres).

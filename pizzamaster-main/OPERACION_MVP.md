
# MVP: Libro PECOSAS / Cierre mensual / Offline / Salud

## 1) Flags (app_settings)
Configuración → Flags:
- flag_enable_pecosa_book
- flag_enable_monthly_closure
- flag_enable_offline_queue
- flag_enable_error_health

Ejecutar defaults (opcional): supabase/migrations/20260125_flags_defaults.sql

## 2) Libro de PECOSAS (MVP)
Ruta: /pecosas
- Si existe tabla pantbc_deliveries, la usa como libro (entregas).
- Si no existe, usa transactions como fallback.
- Exporta Excel/PDF.

## 3) Cierre mensual (Acta)
Ruta: /closure
Genera PDF con firmas manuales.

## 4) Off-line mínimo
- Las anulaciones soportadas se encolan en localStorage cuando no hay conexión.
- Reintentos automáticos al reconectar o al enfocar la app.

## 5) Salud del sistema
Ruta: /health
Muestra últimos 200 registros de client_errors y audit_logs (formateo seguro de JSON).

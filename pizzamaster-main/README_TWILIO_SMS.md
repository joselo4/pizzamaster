
# Twilio SMS para notificar estados del pedido (Supabase + React)

## Arquitectura recomendada (segura)
1) La app cambia el estado en `orders` (Cocina/Delivery/Caja).2) Un trigger en Postgres detecta el cambio de `status` y llama a una **Edge Function** usando `pg_net`.3) La Edge Function envía el SMS con **Twilio** usando credenciales guardadas en **Supabase Secrets**.

> Importante: **NO** pongas credenciales de Twilio en el frontend.

## 1) Crear y desplegar la Edge Function
1. Crea el folder `supabase/functions/notify-sms/` y pega `index.ts`.
2. Coloca secretos:

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_FROM=+1xxxxxxxxxx
supabase secrets set APP_PUBLIC_URL=https://tu-dominio.com
supabase secrets set WEBHOOK_SHARED_SECRET=un_secreto_largo_aleatorio
```

> Alternativa: usa `TWILIO_MESSAGING_SERVICE_SID` en vez de `TWILIO_FROM`.

3. Deploy:

```bash
supabase functions deploy notify-sms
```

## 2) Trigger SQL
Ejecuta `supabase_sql/02_sms_trigger.sql` en Supabase SQL Editor.

### Vault (recomendado)
Crea secretos en Vault (si lo tienes habilitado):

```sql
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('un_secreto_largo_aleatorio', 'sms_webhook_secret');
```

## 3) Personalizar mensajes
Edita la función `buildMessage()` en `notify-sms/index.ts` para mapear tus estados:
- Pendiente
- Horno
- Listo
- En Transporte
- Entregado
- Recogido
- Cancelado

## 4) Prueba rápida
Desde SQL Editor, cambia estado de un pedido real y revisa logs:

```sql
update public.orders set status='Horno' where id=123;
```

Luego revisa:
- Supabase Logs (Edge Functions)
- Twilio Console (Logs de Mensajes)

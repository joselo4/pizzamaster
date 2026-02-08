
-- NOTIFICACIONES SMS (Twilio) por cambio de estado en orders
-- Requiere habilitar la extensión pg_net.
-- Docs: https://supabase.com/docs/guides/database/extensions/pg_net

-- 1) Habilita pg_net (una sola vez)
create extension if not exists pg_net;

-- 2) (Recomendado) Guarda secretos en Vault (evita hardcodear)
-- Necesitas la extensión vault habilitada en tu proyecto.
-- select vault.create_secret('TU_APP_PUBLIC_URL', 'app_public_url');
-- select vault.create_secret('TU_WEBHOOK_SHARED_SECRET', 'sms_webhook_secret');
-- select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');

-- 3) Trigger function
create or replace function public.notify_sms_on_order_status_change()
returns trigger
language plpgsql
security definer
as $$
declare
  project_url text;
  endpoint text;
  webhook_secret text;
  body jsonb;
  req_id bigint;
  req_token uuid;
begin
  -- Sólo si cambió el status
  if new.status is distinct from old.status then

    -- Evita SMS si no hay teléfono
    if new.client_phone is null or length(trim(new.client_phone)) < 6 then
      return new;
    end if;

    -- Ajusta si quieres filtrar por tipos o por payment_status
    -- if new.payment_status = 'Pendiente' then return new; end if;

    -- Obtén project_url y secreto desde Vault si está disponible
    begin
      select decrypted_secret into project_url from vault.decrypted_secrets where name='project_url';
      select decrypted_secret into webhook_secret from vault.decrypted_secrets where name='sms_webhook_secret';
    exception when others then
      project_url := null;
      webhook_secret := null;
    end;

    if project_url is null then
      -- Alternativa: coloca aquí tu URL del proyecto Supabase
      -- project_url := 'https://<PROJECT_REF>.supabase.co';
      raise exception 'project_url no configurado (Vault)';
    end if;

    if webhook_secret is null then
      raise exception 'sms_webhook_secret no configurado (Vault)';
    end if;

    endpoint := project_url || '/functions/v1/notify-sms';

    -- Si este pedido proviene de una Solicitud Web (order_requests), obtenemos su ID y token público
    begin
      select id, public_token into req_id, req_token
      from public.order_requests
      where mapped_order_id = new.id
      order by created_at desc
      limit 1;
    exception when others then
      req_id := null;
      req_token := null;
    end;

    body := jsonb_build_object(
      'order_id', new.id,
      'request_id', req_id,
      'status', new.status,
      'to', new.client_phone,
      'service_type', new.service_type,
      'estimated_minutes', null,
      'public_token', req_token,
      'tracking_url', null
    );

    perform net.http_post(
      url := endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := body
    );
  end if;

  return new;
end;
$$;

-- 4) Crea el trigger en orders
-- Nota: si ya existe, elimínalo y vuelve a crearlo.
drop trigger if exists trg_notify_sms_order_status on public.orders;
create trigger trg_notify_sms_order_status
after update of status on public.orders
for each row
execute function public.notify_sms_on_order_status_change();

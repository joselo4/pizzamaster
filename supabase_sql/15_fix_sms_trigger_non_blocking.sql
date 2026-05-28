-- 15_fix_sms_trigger_non_blocking.sql
create extension if not exists pg_net;
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
  if new.status is distinct from old.status then
    if new.client_phone is null or length(trim(new.client_phone)) < 6 then
      return new;
    end if;
    begin
      select decrypted_secret into project_url from vault.decrypted_secrets where name='project_url';
      select decrypted_secret into webhook_secret from vault.decrypted_secrets where name='sms_webhook_secret';
    exception when others then
      project_url := null;
      webhook_secret := null;
    end;
    if project_url is null or webhook_secret is null then
      return new;
    end if;
    endpoint := project_url || '/functions/v1/notify-sms';
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
    begin
      perform net.http_post(
        url := endpoint,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', webhook_secret
        ),
        body := body
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_sms_order_status on public.orders;
create trigger trg_notify_sms_order_status
after update of status on public.orders
for each row
execute function public.notify_sms_on_order_status_change();

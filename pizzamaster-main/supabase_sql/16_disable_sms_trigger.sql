-- 16_disable_sms_trigger.sql
drop trigger if exists trg_notify_sms_order_status on public.orders;

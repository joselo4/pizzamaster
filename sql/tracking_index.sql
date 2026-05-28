
-- Prevent accidental duplicates of tracking_code
create unique index if not exists orders_tracking_code_uidx
on public.orders (upper(trim(tracking_code)))
where tracking_code is not null;

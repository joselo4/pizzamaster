
insert into public.app_settings(key, value) values
('flag_enable_pecosa_book','true'),
('flag_enable_monthly_closure','true'),
('flag_enable_offline_queue','true'),
('flag_enable_error_health','true')
on conflict (key) do nothing;

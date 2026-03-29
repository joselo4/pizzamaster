create or replace function public.wipe_operational_data_full(
  p_keep_config boolean default true,
  p_include_logs boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wipe_tables text[] := array[
    'orders', 'order_requests', 'system_logs', 'promo_events', 'movements',
    'transactions', 'batches', 'monthly_closures', 'patients', 'centers',
    'kits', 'kit_items', 'ration_rules', 'customers', 'products', 'promotions',
    'pantbc_deliveries', 'pantbc_compliance', 'pantbc_patients'
  ];
  found_tables text[];
  sql_text text;
  touched text[] := '{}';
begin
  if p_include_logs then
    wipe_tables := wipe_tables || array['audit_logs', 'client_errors'];
  end if;
  if not p_keep_config then
    wipe_tables := wipe_tables || array['config'];
  end if;
  select array_agg(t.tablename order by t.tablename)
    into found_tables
  from pg_tables t
  where t.schemaname = 'public'
    and t.tablename = any (wipe_tables);
  if found_tables is null or array_length(found_tables, 1) is null then
    return jsonb_build_object('ok', true, 'message', 'No se encontraron tablas para limpiar.', 'touched', '[]'::jsonb, 'keep_config', p_keep_config, 'include_logs', p_include_logs);
  end if;
  select 'truncate table ' || string_agg(format('public.%I', t), ', ') || ' restart identity cascade'
    into sql_text
  from unnest(found_tables) as t;
  execute sql_text;
  touched := found_tables;
  if not p_keep_config and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'config') then
    insert into public.config (key, text_value)
    values ('pedido_enabled', 'true'), ('delivery_fee', '0'), ('costo_delivery', '0'), ('pedido_default_category', 'promo'), ('pedido_disabled_message', '')
    on conflict (key)
    do update set text_value = excluded.text_value;
  end if;
  perform pg_notify('pgrst', 'reload schema');
  return jsonb_build_object('ok', true, 'message', 'Wipe operativo completado.', 'touched', to_jsonb(touched), 'keep_config', p_keep_config, 'include_logs', p_include_logs);
end;
$$;

grant execute on function public.wipe_operational_data_full(boolean, boolean) to authenticated;

-- 20260216_02_campaign_stats_rpc.sql
create or replace function public.rpc_campaign_stats(p_days int default 30)
returns table (
  campaign_id text,
  views bigint,
  pedido_visits bigint,
  order_requests bigint,
  conv_view_to_order numeric,
  conv_pedido_to_order numeric
)
language sql
stable
as $$
  with e as (
    select campaign_id, event
    from public.promo_events
    where created_at >= now() - (p_days || ' days')::interval
  )
  select
    campaign_id,
    count(*) filter (where event='view') as views,
    count(*) filter (where event='pedido_visit') as pedido_visits,
    count(*) filter (where event='order_request') as order_requests,
    case when count(*) filter (where event='view') = 0 then 0
      else round((count(*) filter (where event='order_request')::numeric / nullif(count(*) filter (where event='view'),0)) * 100, 2)
    end as conv_view_to_order,
    case when count(*) filter (where event='pedido_visit') = 0 then 0
      else round((count(*) filter (where event='order_request')::numeric / nullif(count(*) filter (where event='pedido_visit'),0)) * 100, 2)
    end as conv_pedido_to_order
  from e
  where campaign_id is not null and campaign_id <> ''
  group by campaign_id
  order by order_requests desc;
$$;

revoke all on function public.rpc_campaign_stats(int) from public;
grant execute on function public.rpc_campaign_stats(int) to public;

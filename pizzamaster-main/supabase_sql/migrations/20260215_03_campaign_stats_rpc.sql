-- 20260215_03_campaign_stats_rpc.sql
-- Estadísticas por campaña (campaign_id) usando promo_events

create or replace function public.rpc_campaign_stats(p_from timestamptz, p_to timestamptz)
returns table (
  campaign_id text,
  views bigint,
  pedido_visits bigint,
  order_requests bigint,
  conversion_views_to_orders numeric,
  conversion_pedido_to_orders numeric
)
language sql
stable
as $$
  with e as (
    select campaign_id, event
    from public.promo_events
    where created_at >= p_from and created_at < p_to
  )
  select
    campaign_id,
    count(*) filter (where event='view') as views,
    count(*) filter (where event='pedido_visit') as pedido_visits,
    count(*) filter (where event='order_request') as order_requests,
    case when count(*) filter (where event='view') = 0 then 0
      else round((count(*) filter (where event='order_request')::numeric / nullif(count(*) filter (where event='view'),0)) * 100, 2)
    end as conversion_views_to_orders,
    case when count(*) filter (where event='pedido_visit') = 0 then 0
      else round((count(*) filter (where event='order_request')::numeric / nullif(count(*) filter (where event='pedido_visit'),0)) * 100, 2)
    end as conversion_pedido_to_orders
  from e
  where campaign_id is not null and campaign_id <> ''
  group by campaign_id
  order by order_requests desc;
$$;

revoke all on function public.rpc_campaign_stats(timestamptz, timestamptz) from public;
grant execute on function public.rpc_campaign_stats(timestamptz, timestamptz) to public;

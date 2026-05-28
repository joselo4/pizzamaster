-- 20260216_02b_promo_stats_rpc.sql
create or replace function public.rpc_promo_stats(p_days int default 30)
returns table (
  promo_code text,
  order_requests bigint,
  conv_view_to_order numeric
)
language sql
stable
as $$
  with e as (
    select promo_code, event
    from public.promo_events
    where created_at >= now() - (p_days || ' days')::interval
  ),
  agg as (
    select
      promo_code,
      count(*) filter (where event='view') as views,
      count(*) filter (where event='order_request') as order_requests
    from e
    where promo_code is not null and promo_code <> ''
    group by promo_code
  )
  select
    promo_code,
    order_requests,
    case when views = 0 then 0 else round((order_requests::numeric / nullif(views,0)) * 100, 2) end as conv_view_to_order
  from agg
  order by order_requests desc;
$$;

revoke all on function public.rpc_promo_stats(int) from public;
grant execute on function public.rpc_promo_stats(int) to public;

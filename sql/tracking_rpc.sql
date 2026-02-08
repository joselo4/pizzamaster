
-- Strict tracking RPC (match by exact code or exact id)
create or replace function public.rpc_track_order(
  p_id   bigint default null,
  p_code text   default null
)
returns table (
  id bigint,
  status text,
  tracking_code text,
  created_at timestamptz,
  -- add/remove columns as used by your Track.tsx (safe subset without PII)
  total numeric,
  service_type text
)
language sql
stable
security definer
as $$
  with norm as (
    select p_id as qid,
           case when p_code is null then null else upper(trim(p_code)) end as qcode
  )
  select o.id, o.status, o.tracking_code, o.created_at, o.total, o.service_type
  from public.orders o
  join norm n on true
  where
    (n.qid is not null and o.id = n.qid)
    or
    (n.qcode is not null and upper(trim(o.tracking_code)) = n.qcode)
  order by o.id desc
  limit 1;
$$;

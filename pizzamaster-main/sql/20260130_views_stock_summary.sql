-- 20260130: Vistas para Resumen Integrador (Stock / Alcance / Movimientos / Vencimientos)
-- Compatibles con program_id TEXT

create or replace view public.v_stock_summary as
select
  p.program_id,
  count(*) as products_count,
  sum(coalesce(p.stock_current,0)) as stock_units,
  sum(coalesce(p.stock_current,0) * coalesce(p.average_cost,0))::numeric(14,2) as stock_value,
  sum(case when coalesce(p.stock_current,0) <= 0 then 1 else 0 end) as zero_items
from public.products p
group by p.program_id;

create or replace view public.v_reach_centers as
select
  c.program_id,
  count(*) as centers_count,
  sum(coalesce(c.active_beneficiaries,0)) as active_beneficiaries
from public.centers c
group by c.program_id;

create or replace view public.v_reach_patients as
select
  pa.program_id,
  count(*) as active_patients
from public.patients pa
where coalesce(pa.status,'') = 'ACTIVO'
group by pa.program_id;

create or replace view public.v_recent_movements as
select
  m.program_id,
  date_trunc('hour', m.created_at) as hour,
  sum(case when m.type='IN'  then m.quantity else 0 end) as qty_in,
  sum(case when m.type='OUT' then m.quantity else 0 end) as qty_out
from public.movements m
where m.created_at >= now() - interval '48 hours'
group by m.program_id, date_trunc('hour', m.created_at);

create or replace view public.v_expiring_batches as
select
  b.program_id,
  b.product_id,
  min(b.expiry_date) as next_expiry,
  sum(coalesce(b.quantity_current,0)) as units_impact
from public.batches b
where b.expiry_date is not null
  and b.expiry_date <= (current_date + 60)
group by b.program_id, b.product_id;

select pg_notify('pgrst','reload schema');


-- 20260204_fix_anular_pecosa_autobatch_required_fields_v3_provider.sql
-- QUIRÚRGICO: trg_validate_in_required ahora exige provider_name.
-- Este patch asegura que la anulación (IN reversa) y el lote AUTO incluyan provider_name y doc_ref.
-- Mantiene reglas: no toca triggers, solo completa campos requeridos.

create extension if not exists pgcrypto;

-- Asegurar columnas (idempotente)
alter table if exists public.batches
  add column if not exists provider_name text,
  add column if not exists doc_ref text,
  add column if not exists input_unit_cost numeric;

alter table if exists public.movements
  add column if not exists input_unit_cost numeric,
  add column if not exists provider_name text,
  add column if not exists doc_ref text,
  add column if not exists reversal_of uuid;

create or replace function public.anular_pecosa(p_pecosa_ref text, p_justification text, p_user_email text)
returns jsonb language plpgsql security definer as $$
declare
  tx record;
  m record;
  total_items int := 0;
  v_batch_id bigint;
  v_batch_code text;
  v_unit_cost numeric;
  v_exp date;
  v_provider text;
  v_doc text;
begin
  if p_pecosa_ref is null or length(trim(p_pecosa_ref)) = 0 then raise exception 'pecosa_ref es obligatorio'; end if;
  if p_justification is null or length(trim(p_justification)) < 5 then raise exception 'Justificación mínima 5 caracteres'; end if;

  select * into tx from public.transactions where pecosa_ref = p_pecosa_ref for update;
  if not found then raise exception 'No existe transacción con pecosa_ref=%', p_pecosa_ref; end if;
  if upper(coalesce(tx.status,'')) = 'ANULADA' then raise exception 'La PECOSA % ya está ANULADA', p_pecosa_ref; end if;

  v_unit_cost := 0; -- init
  v_exp := (current_date + 365);
  v_provider := 'AUTO-ANULACION';
  v_doc := concat('ANULACION-', p_pecosa_ref);

  for m in select * from public.movements where type='OUT' and pecosa_ref = p_pecosa_ref order by created_at asc loop
    v_batch_id := m.batch_id;
    v_unit_cost := greatest(coalesce((select average_cost from public.products where id = m.product_id),0), 0.01);

    -- Si el movimiento original trae provider/doc, reutilizar
    if coalesce(m.provider_name,'') <> '' then v_provider := m.provider_name; end if;
    if coalesce(m.doc_ref,'') <> '' then v_doc := m.doc_ref; end if;

    if v_batch_id is null then
      v_batch_code := concat('AUTO-ANUL-', left(p_pecosa_ref, 18), '-', m.product_id);
      insert into public.batches(
        program_id, product_id, batch_code, expiry_date,
        quantity_initial, quantity_current, created_at,
        input_unit_cost, provider_name, doc_ref
      ) values (
        m.program_id, m.product_id, v_batch_code, v_exp,
        abs(coalesce(m.quantity,0)), abs(coalesce(m.quantity,0)), now(),
        v_unit_cost, v_provider, v_doc
      ) returning id into v_batch_id;
    end if;

    insert into public.movements(
      type, program_id, patient_id, product_id, batch_id, quantity,
      pecosa_ref, observation, created_at, reversal_of,
      input_unit_cost, provider_name, doc_ref
    ) values (
      'IN', m.program_id, m.patient_id, m.product_id, v_batch_id, m.quantity,
      concat('ANULACION-', p_pecosa_ref),
      concat('ANULACION ', p_pecosa_ref, ' — ', p_justification),
      now(), m.id,
      v_unit_cost, v_provider, v_doc
    );

    update public.batches set quantity_current = quantity_current + m.quantity where id = v_batch_id;
    total_items := total_items + 1;
  end loop;

  update public.transactions
  set status = 'ANULADA',
      justification = concat(coalesce(justification,''), case when justification is not null and justification <> '' then '; ' else '' end, 'ANULACION: ', p_justification),
      user_email = coalesce(p_user_email, user_email),
      meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object('anulado_por', p_user_email, 'anulado_en', now())
  where pecosa_ref = p_pecosa_ref;

  return jsonb_build_object('status','OK','pecosa_ref',p_pecosa_ref,'items_revertidos',total_items);
end$$;

revoke all on function public.anular_pecosa(text,text,text) from public;
grant execute on function public.anular_pecosa(text,text,text) to authenticated;

select pg_notify('pgrst','reload schema');

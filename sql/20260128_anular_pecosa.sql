
-- 20260128: RPC anular_pecosa
create extension if not exists pgcrypto;

alter table if exists public.movements add column if not exists reversal_of uuid;

create or replace function public.anular_pecosa(p_pecosa_ref text, p_justification text, p_user_email text)
returns jsonb language plpgsql security definer as $$
declare
  tx record;
  m record;
  total_items int := 0;
begin
  if p_pecosa_ref is null or length(trim(p_pecosa_ref)) = 0 then raise exception 'pecosa_ref es obligatorio'; end if;
  if p_justification is null or length(trim(p_justification)) < 5 then raise exception 'Justificación mínima 5 caracteres'; end if;

  select * into tx from public.transactions where pecosa_ref = p_pecosa_ref for update;
  if not found then raise exception 'No existe transacción con pecosa_ref=%', p_pecosa_ref; end if;
  if coalesce(tx.status,'') = 'ANULADA' then raise exception 'La PECOSA % ya está ANULADA', p_pecosa_ref; end if;

  for m in select * from public.movements where type='OUT' and pecosa_ref = p_pecosa_ref order by created_at asc loop
    insert into public.movements (type, program_id, patient_id, product_id, batch_id, quantity, pecosa_ref, observation, created_at, reversal_of)
    values ('IN', m.program_id, m.patient_id, m.product_id, m.batch_id, m.quantity,
            concat('ANULACION-', p_pecosa_ref), concat('ANULACION ', p_pecosa_ref, ' — ', p_justification), now(), m.id);
    if m.batch_id is not null then update public.batches set quantity_current = quantity_current + m.quantity where id = m.batch_id; end if;
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

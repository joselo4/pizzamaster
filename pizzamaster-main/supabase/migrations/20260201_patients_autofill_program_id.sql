-- 20260201_patients_autofill_program_id.sql
-- Fix: pacientes PANTBC puede llegar sin program_id desde frontend

alter table if exists public.patients
  alter column program_id set default 'PANTBC';

create or replace function public.fn_patients_autofill_program()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.program_id is null or trim(coalesce(new.program_id,'')) = '' then
    new.program_id := 'PANTBC';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_patients_autofill_program on public.patients;
create trigger trg_patients_autofill_program
before insert on public.patients
for each row
execute function public.fn_patients_autofill_program();

update public.patients set program_id='PANTBC' where program_id is null;

NOTIFY pgrst, 'reload schema';


-- 20260128: Patients – ensure columns + validación requerida (INSERT/UPDATE)
alter table if exists public.patients add column if not exists region text;
alter table if exists public.patients add column if not exists province text;
alter table if exists public.patients add column if not exists district text;
alter table if exists public.patients add column if not exists health_center text;
alter table if exists public.patients add column if not exists report_officio_number text;
alter table if exists public.patients add column if not exists address text;
alter table if exists public.patients add column if not exists phone text;
alter table if exists public.patients add column if not exists treatment text;
alter table if exists public.patients add column if not exists notes text;

create or replace function public.fn_validate_patients_required()
returns trigger language plpgsql as $$
begin
  if TG_OP in ('INSERT','UPDATE') then
    if (coalesce(trim(new.region), '') = '' or
        coalesce(trim(new.province), '') = '' or
        coalesce(trim(new.district), '') = '' or
        coalesce(trim(new.health_center), '') = '' or
        coalesce(trim(new.report_officio_number), '') = '') then
      raise exception 'Faltan campos obligatorios: Región/Provincia/Distrito/Centro de Salud/Nº Oficio';
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_patients_required on public.patients;
create trigger trg_patients_required before insert or update on public.patients
for each row execute function public.fn_validate_patients_required();

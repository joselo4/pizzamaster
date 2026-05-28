
-- Campos para desactivación con motivación (PANTBC)
alter table public.patients add column if not exists inactive_reason_type text;
alter table public.patients add column if not exists inactive_justification text;
alter table public.patients add column if not exists inactive_at timestamptz;
alter table public.patients add column if not exists inactive_by uuid;

alter table public.patients drop constraint if exists patients_inactive_requires_justification;
alter table public.patients add constraint patients_inactive_requires_justification
check (
  status = 'ACTIVO'
  or (status <> 'ACTIVO' and coalesce(length(trim(inactive_justification)),0) >= 10)
);


-- Optional fields for PANTBC patients (non-destructive)
-- Adds extra columns (including report_document_type) without removing any existing functionality.
-- IMPORTANT: Avoid mass UPDATE on rows that do not meet required fields, because fn_validate_patients_required() blocks UPDATE.

alter table if exists public.patients
  add column if not exists report_document_type text,
  add column if not exists treatment text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists notes text,
  add column if not exists diagnosis text,
  add column if not exists treatment_start_date date;

-- Default for new rows (safe, does not touch existing rows)
alter table if exists public.patients
  alter column report_document_type set default 'OFICIO';

-- Optional: update only rows that already have required fields (safe)
update public.patients
set report_document_type = 'OFICIO'
where report_document_type is null
  and coalesce(trim(region), '') <> ''
  and coalesce(trim(province), '') <> ''
  and coalesce(trim(district), '') <> ''
  and coalesce(trim(health_center), '') <> ''
  and coalesce(trim(report_officio_number), '') <> '';

-- Extiende auditoría (TODA ACCIÓN) a tablas administrativas, si existen.
DO $$
declare
  tbl text;
  trig text;
  tables_to_audit text[] := ARRAY['user_permissions','programs','transactions','app_settings'];
begin
  foreach tbl in array tables_to_audit
  loop
    if to_regclass('public.'||tbl) is not null then
      trig := 'tr_audit_'||tbl;
      execute format('drop trigger if exists %I on public.%I', trig, tbl);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public._audit_change()', trig, tbl);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
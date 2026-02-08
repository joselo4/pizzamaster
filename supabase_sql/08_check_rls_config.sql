-- 08_check_rls_config.sql
select c.relname as table, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relname='config';

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname='public' and tablename='config'
order by policyname;

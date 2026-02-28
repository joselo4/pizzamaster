-- 20260130: PCA subdividido en 3 subprogramas (programs.id es TEXT)
-- Idempotente: no duplica registros

insert into public.programs (id, name, status, created_at)
select v.id, v.name, 'ACTIVO', now()
from (values
  ('PCA_COM', 'PCA · Comedores'),
  ('PCA_HOG', 'PCA · Hogares y Albergues'),
  ('PCA_RSK', 'PCA · Personas en Riesgo')
) as v(id, name)
where not exists (select 1 from public.programs p where p.id = v.id);

select pg_notify('pgrst','reload schema');

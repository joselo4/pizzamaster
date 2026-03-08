-- Storage policies para bucket público: pizza-data
-- Objetivo:
-- 1) Público (anon) puede LEER objetos.
-- 2) Solo rol Admin (según tu session_role()) puede ESCRIBIR/ACTUALIZAR/BORRAR.
--
-- NOTA: Este script asume que tienes session_role() funcionando como en tus otras policies.
-- Ajusta roles si tu proyecto usa otros.

alter table storage.objects enable row level security;

drop policy if exists "Public read pizza-data" on storage.objects;
create policy "Public read pizza-data"
  on storage.objects for select
  using (bucket_id = 'pizza-data');

drop policy if exists "Admin write pizza-data" on storage.objects;
create policy "Admin write pizza-data"
  on storage.objects for insert
  with check (bucket_id = 'pizza-data' and session_role() = 'Admin');

drop policy if exists "Admin update pizza-data" on storage.objects;
create policy "Admin update pizza-data"
  on storage.objects for update
  using (bucket_id = 'pizza-data' and session_role() = 'Admin')
  with check (bucket_id = 'pizza-data' and session_role() = 'Admin');

drop policy if exists "Admin delete pizza-data" on storage.objects;
create policy "Admin delete pizza-data"
  on storage.objects for delete
  using (bucket_id = 'pizza-data' and session_role() = 'Admin');

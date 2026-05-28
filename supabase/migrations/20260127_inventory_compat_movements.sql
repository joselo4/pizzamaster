
-- 20260127_inventory_compat_movements.sql
-- Compatibilidad entre columnas type y movement_type en public.movements

alter table public.movements add column if not exists type text;

create or replace function public.movements_sync_type()
returns trigger
language plpgsql
as $$
begin
  if (new.movement_type is null or new.movement_type = '') and new.type is not null and new.type <> '' then
    new.movement_type := new.type;
  end if;

  if (new.type is null or new.type = '') and new.movement_type is not null and new.movement_type <> '' then
    new.type := new.movement_type;
  end if;

  if new.type is not null then new.type := upper(new.type); end if;
  if new.movement_type is not null then new.movement_type := upper(new.movement_type); end if;

  return new;
end;
$$;

drop trigger if exists trg_movements_sync_type on public.movements;
create trigger trg_movements_sync_type
before insert or update on public.movements
for each row execute function public.movements_sync_type();

-- Recargar schema cache PostgREST
NOTIFY pgrst, 'reload schema';

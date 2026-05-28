-- Ejecutar una vez en Supabase SQL Editor:
update public.config
set numeric_value = null
where key = 'pedido_categories';

select key, text_value, numeric_value
from public.config
where key = 'pedido_categories';

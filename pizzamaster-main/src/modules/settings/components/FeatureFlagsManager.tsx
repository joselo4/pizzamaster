
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { notifySuccess, notifyError } from '../../../core/utils/notify';
import { useAuth } from '../../../core/context/AuthContext';
import { Shield, Save } from 'lucide-react';

const FLAGS = [
  { key: 'flag_enable_pecosa_book', label: 'Libro de PECOSAS (MVP)', desc: 'Búsqueda, filtros y exportación (Excel/PDF).' },
  { key: 'flag_enable_monthly_closure', label: 'Cierre mensual (Acta)', desc: 'Acta imprimible con líneas de firmas manuales.' },
  { key: 'flag_enable_offline_queue', label: 'Off-line mínimo', desc: 'Reintentos automáticos y cola para operaciones soportadas (MVP).' },
  { key: 'flag_enable_error_health', label: 'Dashboard de errores/auditoría', desc: 'Vista de errores del cliente y auditoría extendida.' },
];

export const FeatureFlagsManager = () => {
  const { role } = useAuth();
  const isViewer = role === 'viewer';
  const qc = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ['flags_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').like('key','flag_%');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const map = useMemo(() => {
    const m: Record<string,string> = {};
    (rows||[]).forEach((r:any)=> m[r.key]=String(r.value));
    return m;
  }, [rows]);

  const mut = useMutation({
    mutationFn: async ({key, value}:{key:string; value:string}) => {
      if (isViewer) throw new Error('Modo solo lectura');
      const { error } = await supabase.from('app_settings').upsert({ key, value });
      if (error) throw error;
    },
    onSuccess: ()=>{ notifySuccess('Configuración guardada.'); qc.invalidateQueries({queryKey:['flags_settings']}); },
    onError: (e:any)=> notifyError(e?.message || e)
  });

  return (
    <div className="bg-white p-6 rounded shadow border-l-4 border-indigo-600 space-y-4">
      <div className="flex items-center gap-2"><Shield className="text-indigo-600"/><h3 className="font-bold text-gray-800">Flags (Funciones habilitables)</h3></div>
      <p className="text-xs text-gray-500">Activa/desactiva módulos sin recompilar. Requiere rol Administrador/Operador.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FLAGS.map(f=>{
          const cur = (map[f.key]||'false').toLowerCase()==='true';
          return (
            <div key={f.key} className="border rounded p-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-sm">{f.label}</div>
                <div className="text-xs text-gray-500">{f.desc}</div>
                <div className="text-[10px] text-gray-400 mt-1">{f.key}</div>
              </div>
              <button
                disabled={isViewer || mut.isPending}
                onClick={()=> mut.mutate({ key: f.key, value: String(!cur) })}
                className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 ${cur?'bg-green-600 text-white':'bg-gray-100 text-gray-700'}`}
              >
                <Save size={14}/> {cur?'ACTIVO':'INACTIVO'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

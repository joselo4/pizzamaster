import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { CheckCircle, XCircle } from 'lucide-react';

export const AdherenceManager = () => {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(new Date().getFullYear());

  const { data: records } = useQuery({
    queryKey: ['adherence', month, year],
    queryFn: async () => {
      const { data: patients } = await supabase.from('pantbc_patients').select('id, full_name, dni').eq('status', 'ACTIVO');
      const { data: compliance } = await supabase.from('pantbc_compliance').select('*').eq('month', month).eq('year', year);
      return patients?.map((p: any) => ({
        ...p, status: compliance?.find((c: any) => c.patient_id === p.id)?.status || 'PENDIENTE'
      }));
    }
  });

  const mutation = useMutation({
    mutationFn: async ({ patientId, status }: { patientId: number, status: string }) => {
      await supabase.from('pantbc_compliance').upsert({ patient_id: patientId, month, year, status }, { onConflict: 'patient_id, year, month' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adherence'] })
  });

  return (
    <div className="bg-white rounded shadow p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="font-bold text-gray-800 text-sm">Control Adherencia (Mes {month})</h3>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded p-1 text-sm bg-gray-50">{[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Mes {m}</option>)}</select>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {records?.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 bg-white">
            <div className="w-3/4"><div className="font-bold text-xs truncate">{p.full_name}</div><div className="text-[10px] text-gray-500">{p.dni}</div></div>
            <div className="flex gap-1">
              <button onClick={() => mutation.mutate({ patientId: p.id, status: 'CUMPLIO' })} className={`p-1 rounded ${p.status === 'CUMPLIO' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-300'}`}><CheckCircle size={16}/></button>
              <button onClick={() => mutation.mutate({ patientId: p.id, status: 'ABANDONO' })} className={`p-1 rounded ${p.status === 'ABANDONO' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-300'}`}><XCircle size={16}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
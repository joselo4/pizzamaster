import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { Save, AlertCircle, Layers } from 'lucide-react';
import { notifySuccess, notifyError } from '../../../core/utils/notify';

export const RationManager = () => {
  const { programId } = useProgram();
  const queryClient = useQueryClient();
  const [localRules, setLocalRules] = useState<any>({});

  const { data: groupedData } = useQuery({
    queryKey: ['ration_products', programId],
    queryFn: async () => {
      const { data: prods } = await supabase.from('products').select('*').eq('program_id', programId).order('name');
      const { data: rules } = await supabase.from('ration_rules').select('*').eq('program_id', programId);

      const processed = prods?.map((p: any) => ({
        ...p,
        ration: rules?.find((r: any) => r.product_id === p.id)?.quantity_per_person_day || 0
      })) || [];

      return processed.reduce((acc: any, item: any) => {
        const cat = item.category || 'OTROS / SIN CATEGORÍA';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      }, {});
    }
  });

const mutation = useMutation({
  mutationFn: async () => {
    const prodIds = Object.keys(localRules);
    if (prodIds.length === 0) return;

    const updates = prodIds.map(async (prodId) => {
      const qty = Number(localRules[prodId]);

      // Validación
      if (!Number.isFinite(qty) || qty < 0) return;

      const { error } = await supabase
        .from('ration_rules')
        .upsert(
          {
            program_id: programId,
            product_id: Number(prodId),
            quantity_per_person_day: qty,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'program_id,product_id' }
        );

      if (error) throw error;
    });

    await Promise.all(updates);
  },

  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['ration_products', programId] });
    setLocalRules({});
    notifySuccess('Cambios guardados correctamente.');
  },

  onError: (e: any) =>
    notifyError(e, 'No se pudo guardar la configuración nutricional.'),
});

  const handleInput = (id: number, val: string) => {
    setLocalRules({ ...localRules, [id]: val });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Configuración Nutricional</h3>
          <p className="text-sm text-gray-500">Defina los gramos/litros por persona al día.</p>
        </div>
        <button onClick={() => mutation.mutate()} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow">
          <Save size={18} /> Guardar Todo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groupedData && Object.keys(groupedData).sort().map((cat: string) => (
          <div key={cat} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2 font-bold text-gray-700">
              <Layers size={16} className="text-orange-500"/> {cat}
            </div>
            <div className="p-4 space-y-3">
              {groupedData[cat].map((p: any) => (
                <div key={p.id} className="flex items-center justify-between group">
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{p.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">STOCK: {p.stock_current} {p.unit}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" step="0.0001"
                      className="w-24 text-right border rounded p-1 font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-gray-50 focus:bg-white"
                      defaultValue={p.ration}
                      onChange={(e) => handleInput(p.id, e.target.value)}
                    />
                    <span className="text-xs text-gray-500 w-8">{p.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!groupedData && <p className="text-center p-10 text-gray-400">Cargando productos...</p>}
      <div className="bg-blue-50 text-blue-800 p-3 rounded text-xs flex gap-2 items-center">
        <AlertCircle size={16}/> 
        <span>Recuerde: Para ingresar 150 gramos, escriba <strong>0.150</strong> (si la unidad es KG).</span>
      </div>
    </div>
  );
};
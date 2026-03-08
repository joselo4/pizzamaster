import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { generatePecosaPDF } from '../utils/pecosaGenerator';

async function ensurePecosaAvailable(ref: string) {
  const r = String(ref||'').trim();
  if (!r) return;
  const { data } = await supabase.from('transactions').select('pecosa_ref,status').eq('pecosa_ref', r).maybeSingle();
  if (data?.pecosa_ref) throw new Error(`PECOSA ${r} ya existe (${String(data.status||'')}). Use Reimprimir.`);
}

export const PcaDistributionForm = () => {
  const queryClient = useQueryClient();
  const [selectedCenterId, setSelectedCenterId] = useState<number | null>(null);
  const [daysToAttend, setDaysToAttend] = useState(20); // Default 20 días

  // 1. Cargar Centros y Productos (Raciones)
  const { data: centers } = useQuery({
    queryKey: ['centers', 'PCA'],
    queryFn: async () => {
      const { data } = await supabase.from('centers').select('*').eq('program_id', 1); // 1 = PCA
      return data || [];
    }
  });

  const { data: rationRules } = useQuery({
    queryKey: ['ration_rules'],
    queryFn: async () => {
      // Unir con productos para saber el stock actual
      const { data } = await supabase
        .from('ration_rules')
        .select('*, products(name, stock_current, average_cost, unit)');
      return data || [];
    }
  });

  // 2. Calcular Requerimientos en Tiempo Real
  const selectedCenter = centers?.find(c => c.id === selectedCenterId);
  const calculationPreview = rationRules?.map(rule => {
    const totalNeeded = (selectedCenter?.active_beneficiaries || 0) * daysToAttend * rule.quantity_per_person_day;
    const hasStock = (rule.products as any).stock_current >= totalNeeded;
    return { ...rule, totalNeeded, hasStock };
  });

  // 3. Ejecutar Salida Masiva (Transacción)
  const distributeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCenter || !calculationPreview) return;
      
      const movements = calculationPreview.map(item => ({
        type: 'OUT',
        program_id: 1, // PCA
        center_id: selectedCenter.id,
        product_id: item.product_id,
        quantity: item.totalNeeded,
        pecosa_ref: `PECOSA-${Date.now()}`, // Generar correlativo real en producción
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('movements').insert(movements);
      if (error) throw error;
      
      return movements;
    },
    onSuccess: (movements) => {
      alert('Distribución registrada. Generando PECOSA...');
      queryClient.invalidateQueries({ queryKey: ['ration_rules'] }); // Refrescar stock
      // Generar PDF
      if(selectedCenter && movements) {
         generatePecosaPDF(selectedCenter, movements, daysToAttend);
      }
    },
    onError: (err) => alert('Error en distribución: ' + err.message)
  });

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Distribución Mensual - PCA</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <select 
          className="border p-2 rounded" 
          onChange={(e) => setSelectedCenterId(Number(e.target.value))}
        >
          <option value="">Seleccione Comedor...</option>
          {centers?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.active_beneficiaries} Benef.)</option>)}
        </select>

        <input 
          type="number" 
          value={daysToAttend} 
          onChange={(e) => setDaysToAttend(Number(e.target.value))}
          className="border p-2 rounded" 
          placeholder="Días de atención"
        />
      </div>

      {/* Tabla de Pre-cálculo */}
      {selectedCenter && (
        <table className="w-full text-sm mb-4 border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Producto</th>
              <th className="p-2">Ración (g)</th>
              <th className="p-2">Total a Salir</th>
              <th className="p-2">Stock Disponible</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {calculationPreview?.map((row: any) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.products.name}</td>
                <td className="p-2">{row.quantity_per_person_day}</td>
                <td className="p-2 font-bold">{row.totalNeeded.toFixed(2)} {row.products.unit}</td>
                <td className="p-2">{row.products.stock_current.toFixed(2)}</td>
                <td className={`p-2 font-bold ${row.hasStock ? 'text-green-600' : 'text-red-600'}`}>
                  {row.hasStock ? 'OK' : 'STOCK INSUFICIENTE'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        onClick={() => distributeMutation.mutate()}
        disabled={!selectedCenter || distributeMutation.isPending || calculationPreview?.some((x:any) => !x.hasStock)}
        className="w-full bg-green-700 text-white p-3 rounded hover:bg-green-800 disabled:bg-gray-400"
      >
        {distributeMutation.isPending ? 'Procesando Salida...' : 'GENERAR PECOSA Y DESCONTAR STOCK'}
      </button>
    </div>
  );
};
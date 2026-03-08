// CORRECCIÓN: Se eliminó 'useState' que no se usaba
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { Product } from '../../../core/types/db';

// Componente para registrar una COMPRA (Entrada)
export const PurchaseForm = ({ product }: { product: Product }) => {
  const { programId } = useProgram();
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, reset } = useForm();
  
  // Observar valores para cálculo en tiempo real
  const newQty = parseFloat(watch('quantity') || '0');
  const newCost = parseFloat(watch('input_unit_cost') || '0');

  // Lógica de Simulación PMP (Solo visual, el DB Trigger hace el real)
  const simulatedTotalStock = product.stock_current + newQty;
  const simulatedTotalValue = (product.stock_current * product.average_cost) + (newQty * newCost);
  const simulatedPMP = simulatedTotalStock > 0 ? simulatedTotalValue / simulatedTotalStock : 0;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('movements').insert({
        type: 'IN',
        program_id: programId,
        product_id: product.id,
        quantity: data.quantity,
        input_unit_cost: data.input_unit_cost,
        provider_ruc: data.provider_ruc,
        provider_name: data.provider_name,
        invoice_number: data.invoice_number,
        quality_check: true, // Asumimos check en UI
        observation: data.observation
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      reset();
      alert('Compra registrada correctamente. Kardex actualizado.');
    }
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-4 bg-white rounded shadow">
      <h3 className="text-lg font-bold mb-4 text-blue-900">Registrar Compra: {product.name}</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Datos Proveedor */}
        <div className="col-span-2 grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded">
            <input {...register('provider_ruc')} placeholder="RUC Proveedor" className="border p-2" required />
            <input {...register('provider_name')} placeholder="Razón Social" className="border p-2 col-span-2" required />
            <input {...register('invoice_number')} placeholder="N° Factura / Guía" className="border p-2" required />
        </div>

        {/* Datos Económicos */}
        <div>
          <label className="block text-sm">Cantidad ({product.unit})</label>
          <input 
            type="number" step="0.0001" 
            {...register('quantity', { required: true })} 
            className="w-full border p-2 rounded" 
          />
        </div>
        <div>
          <label className="block text-sm">Costo Unitario (S/.)</label>
          <input 
            type="number" step="0.0001" 
            {...register('input_unit_cost', { required: true })} 
            className="w-full border p-2 rounded" 
          />
        </div>
      </div>

      {/* Simulación de Impacto Financiero */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
        <p><strong>Stock Actual:</strong> {product.stock_current} a S/. {product.average_cost.toFixed(4)}</p>
        <p className="text-blue-600 font-bold mt-1">
          Simulación PMP: El nuevo costo promedio será S/. {simulatedPMP.toFixed(4)}
        </p>
      </div>

      <button 
        type="submit" 
        disabled={mutation.isPending}
        className="mt-4 w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700 transition"
      >
        {mutation.isPending ? 'Procesando...' : 'Confirmar Ingreso al Almacén'}
      </button>
    </form>
  );
};
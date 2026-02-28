import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { Plus, Edit, Save, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';

export const ProductsManager = () => {
  const { programId } = useProgram();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [adjustingStock, setAdjustingStock] = useState<any>(null); 
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ name: '', unit: 'KG' });
  const [stockData, setStockData] = useState<any>({ newStock: '', reason: '' });

  const { data: products } = useQuery({
    queryKey: ['products', programId],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('program_id', programId).order('name');
      return data || [];
    }
  });

  const stockMutation = useMutation({
    mutationFn: async () => {
        if (!stockData.reason || stockData.reason.length < 5) throw new Error("NOTA OBLIGATORIA: Escriba el motivo del ajuste.");
        // Actualizar Stock
        { const { error } = await supabase.from('products').update({ stock_current: stockData.newStock }).eq('id', adjustingStock.id); if (error) throw error; }
        // Guardar en Log
        await audit('UI_AUDIT', { 
            action: 'AJUSTE_STOCK', 
            details: `Prod: ${adjustingStock.name}. Stock anterior: ${adjustingStock.stock_current}. Nuevo: ${stockData.newStock}. MOTIVO: ${stockData.reason}`, 
            user_email: 'admin_session', 
            program_id: programId 
        }, null);
    },
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', programId] }); 
        queryClient.invalidateQueries({ queryKey: ['audit_logs'] }); // Actualiza logs globales
        setAdjustingStock(null); setStockData({ newStock: '', reason: '' }); 
        alert("Stock actualizado y registrado en log."); 
    },
    onError: (e:any) => alert(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
        if (!stockData.reason || stockData.reason.length < 5) throw new Error("NOTA OBLIGATORIA: Motivo de eliminación.");
        await supabase.from('products').delete().eq('id', deletingProduct.id);
        await audit('UI_AUDIT', { action: 'ELIMINAR_PRODUCTO', details: `Eliminado: ${deletingProduct.name}. MOTIVO: ${stockData.reason}`, user_email: 'admin_session', program_id: programId }, null);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', programId] }); setDeletingProduct(null); setStockData({ newStock: '', reason: '' }); },
    onError: (e:any) => alert(e.message)
  });

  const productMutation = useMutation({
    mutationFn: async (data: any) => {
        const payload = { name: data.name.toUpperCase(), unit: data.unit, program_id: programId };
        if(editingProduct) await supabase.from('products').update(payload).eq('id', editingProduct.id);
        else await supabase.from('products').insert({ ...payload, stock_current: 0, average_cost: 0 });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', programId] }); setEditingProduct(null); setFormData({ name: '', unit: 'KG' }); }
  });

  return (
    <div className="space-y-6">
        <div className="bg-white p-4 rounded shadow border-l-4 border-green-600 flex gap-4 items-end">
            <div className="flex-1"><label className="text-xs font-bold text-gray-500">PRODUCTO</label><input className="w-full border p-2 rounded uppercase" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})}/></div>
            <div className="w-32"><label className="text-xs font-bold text-gray-500">UNIDAD</label><select className="w-full border p-2 rounded" value={formData.unit} onChange={e=>setFormData({...formData, unit:e.target.value})}><option value="KG">KG</option><option value="LITRO">LITRO</option><option value="UNIDAD">UNIDAD</option><option value="LATA">LATA</option></select></div>
            <button onClick={()=>productMutation.mutate(formData)} disabled={!formData.name} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-2"><Plus size={18}/> CREAR</button>
        </div>
        <div className="bg-white rounded shadow overflow-hidden">
            <table className="w-full text-sm"><thead className="bg-gray-100 uppercase text-xs text-gray-600"><tr><th className="p-3 text-left">Producto</th><th className="p-3 text-right">Stock</th><th className="p-3 text-center">Acciones</th></tr></thead>
                <tbody className="divide-y">{products?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold">{p.name} <span className="text-xs font-normal text-gray-400">({p.unit})</span></td>
                        <td className="p-3 text-right font-mono font-bold text-blue-700">{p.stock_current}</td>
                        <td className="p-3 flex justify-center gap-2">
                            <button onClick={()=>{setEditingProduct(p); setFormData(p)}} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>
                            <button onClick={()=>{setAdjustingStock(p); setStockData({newStock: p.stock_current, reason: ''})}} className="text-orange-500 hover:text-orange-700 bg-orange-50 px-2 py-1 rounded flex gap-1 items-center font-bold text-[10px]"><RefreshCw size={12}/> AJUSTAR</button>
                            <button onClick={()=>{setDeletingProduct(p); setStockData({newStock: 0, reason: ''})}} className="text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded flex gap-1 items-center font-bold text-[10px]"><Trash2 size={12}/> ELIMINAR</button>
                        </td>
                    </tr>
                ))}</tbody>
            </table>
        </div>
        {(adjustingStock || deletingProduct) && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded shadow-lg w-full max-w-md border-t-4 border-orange-500">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><AlertTriangle className="text-orange-500"/> {adjustingStock ? 'Ajustar Inventario' : 'Eliminar Producto'}</h3>
                    <p className="text-xs text-gray-500 mb-4 bg-yellow-50 p-2 rounded">Esta acción requiere una nota obligatoria y quedará registrada en el LOG de auditoría.</p>
                    {adjustingStock && (<div className="mb-4"><label className="block text-xs font-bold text-blue-700 mb-1">NUEVO STOCK REAL</label><input type="number" step="0.01" className="w-full border-2 border-blue-100 p-2 rounded text-lg font-bold text-blue-800" value={stockData.newStock} onChange={e=>setStockData({...stockData, newStock: e.target.value})} autoFocus/></div>)}
                    <div className="mb-4"><label className="block text-xs font-bold text-red-600 mb-1">MOTIVO (OBLIGATORIO)</label><textarea className="w-full border-2 border-red-100 p-2 rounded text-sm min-h-[80px]" placeholder="Motivo del cambio..." value={stockData.reason} onChange={e=>setStockData({...stockData, reason: e.target.value})}/></div>
                    <div className="flex justify-end gap-2 border-t pt-4"><button onClick={()=>{setAdjustingStock(null); setDeletingProduct(null)}} className="px-4 py-2 text-gray-600 font-bold text-sm">CANCELAR</button><button onClick={() => adjustingStock ? stockMutation.mutate() : deleteMutation.mutate()} disabled={!stockData.reason || stockData.reason.length < 5} className="px-4 py-2 bg-orange-600 text-white rounded font-bold text-sm hover:bg-orange-700 disabled:bg-gray-300 flex items-center gap-2"><Save size={16}/> CONFIRMAR</button></div>
                </div>
            </div>
        )}
    </div>
  );
};
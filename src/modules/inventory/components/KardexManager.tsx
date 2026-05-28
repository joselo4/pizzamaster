import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useAuth } from '../../../core/context/AuthContext';
import { usePermissions2 } from '../../../core/utils/permissions2';
import { notifySuccess, notifyError } from '../../../core/utils/notify';
import { notifySuccess, notifyError } from '../../../core/utils/notify';
import { auditLog } from '../../../core/utils/audit';
import { useProgram } from '../../../core/context/ProgramContext';
import {Trash2, ArrowUpCircle, ArrowDownCircle, Undo2} from 'lucide-react'; // CORREGIDO: Se quitó 'FileText'

export const KardexManager = () => {
  const { session } = useAuth();
  const { can } = usePermissions2();
  const isAdmin = can('settings:admin');
  const [openRevert, setOpenRevert] = useState(false);
  const [revertTarget, setRevertTarget] = useState<any>(null);
  const [revertJust, setRevertJust] = useState('');
  const { programId } = useProgram();
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const queryClient = useQueryClient();

  const revertMutation = useMutation({
    mutationFn: async () => {
      if (!revertTarget) return;
      if (!revertJust || revertJust.trim().length < 5) throw new Error('Justificación mínima 5 caracteres');
      const { data, error } = await supabase.rpc('revert_movement', {
        p_movement_id: revertTarget.id,
        p_justification: revertJust.trim(),
        p_user_email: session?.user?.email || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      notifySuccess('Movimiento revertido.');
      setOpenRevert(false);
      setRevertTarget(null);
      setRevertJust('');
    },
    onError: (e:any) => notifyError(e),
  });

  // 1. OBTENER HISTORIAL (KARDEX)
  const { data: movements, isLoading } = useQuery({
    queryKey: ['movements', programId, showAllPrograms],
    queryFn: async () => {
      const { data } = await supabase
        .from('movements')
        .select('*, products(name, unit), centers(name)')
        .eq('program_id', programId)
        .order('created_at', { ascending: false })
        .limit(50); // Últimos 50 movimientos
      return data || [];
    }
  });

  // 2. ELIMINAR MOVIMIENTO (CORRECCIÓN KARDEX)
  const deleteMutation = useMutation({
    mutationFn: async (mov: any) => {
        const doReverse = confirm('¿Borrar el movimiento y generar reversión de stock automática? (OK = borrar y crear compensación / Cancelar = solo borrar)');
        
        await supabase.from('movements').delete().eq('id', mov.id);
        
        // Log de auditoría
        await audit('UI_AUDIT', {
            action: 'BORRAR_KARDEX',
            details: `Se borró movimiento ${mov.type} de ${mov.products?.name}. Cantidad: ${mov.quantity}`,
            user_email: 'admin_session',
            program_id: programId
        }, null);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['movements'] });
        alert("Movimiento eliminado del historial.");
    }
  });

  if (isLoading) return <div className="p-4">Cargando Kardex...</div>;

  return (
    <div className="bg-white rounded shadow border overflow-hidden">
        <div className="p-3 bg-gray-50 border-b font-bold text-gray-700 flex justify-between">
            <div className="flex items-center gap-3">
              <span>Kardex (Últimos Movimientos)</span>
              <label className="text-xs font-bold text-gray-600 flex items-center gap-2">
                <input type="checkbox" className="accent-blue-900" checked={showAllPrograms} onChange={(e)=>setShowAllPrograms(e.target.checked)} />
                Todos los programas
              </label>
            </div>
            <span className="text-xs font-normal text-gray-500">Para corregir stock, use el botón "AJUSTAR" en la tabla de arriba.</span>
        </div>
        <table className="w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3 text-left">Producto</th>
                    <th className="p-3 text-center">Cant.</th>
                    <th className="p-3 text-left">Destino / Nota</th>
                    <th className="p-3">Acción</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {movements?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-500 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-center">
                            {m.type === 'IN' 
                                ? <span className="flex items-center gap-1 text-green-700 font-bold text-[10px]"><ArrowDownCircle size={14}/> ENTRADA</span>
                                : <span className="flex items-center gap-1 text-orange-700 font-bold text-[10px]"><ArrowUpCircle size={14}/> SALIDA</span>
                            }
                        </td>
                        <td className="p-3 font-medium">{m.products?.name || '???'}</td>
                        <td className="p-3 text-center font-bold">{m.quantity} {m.products?.unit}</td>
                        <td className="p-3 text-xs text-gray-600">
                            <div className="font-bold">{m.centers?.name || '---'}</div>
                            <div className="text-gray-400 italic">{m.observation}</div>
                        </td>
                        <td className="p-3 text-center">
                            <button onClick={() => deleteMutation.mutate(m)} className="text-red-400 hover:text-red-600 p-1" title="Eliminar registro">
                                <Trash2 size={16}/>
                            </button>
                        </td>
                    </tr>
                ))}
                {movements?.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay movimientos registrados en el Kardex.</td></tr>}
            </tbody>
        </table>
    </div>

{openRevert && revertTarget && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-lg rounded shadow border-t-4 border-orange-600 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800">Revertir movimiento</h3>
        <button onClick={() => { setOpenRevert(false); setRevertTarget(null); setRevertJust(''); }} className="text-xs font-bold text-gray-500">CERRAR</button>
      </div>

      <div className="text-xs text-gray-600 mb-2">Se generará un movimiento inverso para: <span className="font-bold">{String(revertTarget.id).slice(0,8)}...</span></div>

      <label className="text-[10px] font-bold text-gray-500">JUSTIFICACIÓN (mín. 5 caracteres)</label>
      <textarea value={revertJust} onChange={e=>setRevertJust(e.target.value)} className="w-full border p-2 rounded text-sm min-h-[90px]" placeholder="Motivo de la reversa..." />

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={() => { setOpenRevert(false); setRevertTarget(null); setRevertJust(''); }} className="px-4 py-2 text-xs font-bold text-gray-600">CANCELAR</button>
        <button onClick={() => revertMutation.mutate()} disabled={revertMutation.isPending} className="px-5 py-2 rounded bg-orange-600 text-white text-xs font-bold disabled:bg-gray-400">
          {revertMutation.isPending ? 'REVIRTIENDO...' : 'CONFIRMAR'}
        </button>
      </div>
    </div>
  </div>
)}
  );
};
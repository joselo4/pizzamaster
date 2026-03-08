
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useAuth } from '../../../core/context/AuthContext';

export const PecosaBook = () => {
  const { role, session } = useAuth();
  const queryClient = useQueryClient();
  const canAnnul = role !== 'viewer';
  const [programFilter, setProgramFilter] = useState<string>('ALL');

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['pecosa_book_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, pecosa_ref, category, amount, status, created_at, meta, program_id')
        .eq('type', 'PECOSA')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [] as any[];
    if (programFilter === 'ALL') return rows;
    return rows.filter((r: any) => (r.category ?? '').toUpperCase() === programFilter);
  }, [rows, programFilter]);

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [just, setJust] = useState('');
  const [busy, setBusy] = useState(false);

  const annul = async (row: any) => {
    if (!just || just.trim().length < 5) { alert('Justificación mínima 5 caracteres'); return; }
    setBusy(true);
    const ref = row.pecosa_ref ?? row.meta?.pecosa;
    const { error } = await supabase.rpc('anular_pecosa', {
      p_pecosa_ref: ref,
      p_justification: just.trim(),
      p_user_email: session?.user?.email ?? null,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setOpenIdx(null); setJust('');
    queryClient.invalidateQueries({ queryKey: ['pecosa_book_all'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['kardex500'] });
    alert('PECOSA anulada y stock revertido.');
  };

  return (
    <div className="bg-white p-4 rounded shadow border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800">Libro de PECOSAS (MVP)</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Programa</label>
          <select value={programFilter} onChange={(e)=>setProgramFilter(e.target.value)} className="border rounded text-xs p-1">
            <option value="ALL">Todos</option>
            <option value="PCA">PCA</option>
            <option value="PANTBC">PANTBC</option>
            <option value="OLLAS">OLLAS</option>
          </select>
        </div>
      </div>
      {error ? (
        <div className="text-red-600 text-sm">Error: {String((error as any)?.message ?? error)}</div>
      ) : isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : !filtered || filtered.length === 0 ? (
        <p className="text-gray-400">Sin registros</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-2 text-left">PECOSA</th>
                <th className="p-2 text-left">Categoría</th>
                <th className="p-2 text-left">Estado</th>
                <th className="p-2 text-left">Monto</th>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any, idx: number) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono">{r.pecosa_ref ?? r.meta?.pecosa ?? '—'}</td>
                  <td className="p-2">{r.category ?? '—'}</td>
                  <td className="p-2">{r.status ?? 'EMITIDA'}</td>
                  <td className="p-2">S/. {Number(r.amount ?? 0).toFixed(2)}</td>
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2">
                    {canAnnul && (r.status ?? 'EMITIDA') !== 'ANULADA' ? (
                      <button onClick={() => { setOpenIdx(idx); setJust(''); }} className="px-2 py-1 text-xs font-bold rounded border border-red-300 text-red-700 hover:bg-red-50">ANULAR</button>
                    ) : (<span className="text-xs text-gray-400">—</span>)}

                    {openIdx === idx && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-md rounded shadow border-t-4 border-red-600">
                          <div className="p-4 border-b">
                            <h4 className="font-bold text-red-800">Anular PECOSA {r.pecosa_ref ?? r.meta?.pecosa}</h4>
                            <p className="text-[12px] text-gray-600">La anulación revertirá el stock en los lotes involucrados y actualizará el libro.</p>
                          </div>
                          <div className="p-4">
                            <label className="text-[11px] font-bold text-gray-500">Justificación (obligatoria)</label>
                            <textarea value={just} onChange={(e) => setJust(e.target.value)} className="w-full border rounded p-2 text-sm min-h-[90px]" placeholder="Detalle la razón de anulación" />
                            <div className="flex justify-end gap-2 mt-3">
                              <button onClick={() => setOpenIdx(null)} className="px-3 py-1 text-xs">Cancelar</button>
                              <button onClick={() => annul(r)} disabled={busy || !just || just.trim().length < 5} className="px-4 py-1 text-xs font-bold bg-red-600 text-white rounded disabled:bg-gray-400">{busy ? 'Procesando…' : 'Confirmar anulación'}</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

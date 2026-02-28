
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../core/api/supabase';
import { getProgramLabel } from '../../core/context/ProgramContext';

export const GlobalStockPage = () => {
  const [q, setQ] = useState('');

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['global_stock_products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,unit,program_id,stock_current,average_cost')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const programs = useMemo(() => {
    const set = new Set<string>();
    for (const p of (products ?? [])) set.add(String((p as any).program_id || ''));
    return Array.from(set).filter(Boolean).sort();
  }, [products]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = (products ?? []).filter((p: any) => !term || String(p.name || '').toLowerCase().includes(term));
    const map = new Map<string, any>();
    for (const p of filtered) {
      const key = `${String(p.name || '').toUpperCase()}|${String(p.unit || '')}`;
      if (!map.has(key)) map.set(key, { name: p.name, unit: p.unit, total: 0, value: 0, byProgram: {} as Record<string, number> });
      const r = map.get(key);
      const sc = Number(p.stock_current || 0);
      const cost = Number(p.average_cost || 0);
      r.total += sc;
      r.value += sc * cost;
      r.byProgram[p.program_id] = (r.byProgram[p.program_id] || 0) + sc;
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [products, q]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-6 rounded shadow border-l-4 border-emerald-600">
        <h2 className="text-xl font-black text-gray-800">Stock General</h2>
        <p className="text-xs text-gray-500">Consolidado por programa y total (solo lectura).</p>
      </div>
      <div className="bg-white p-4 rounded shadow">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <input className="border p-2 rounded w-full md:w-96" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto..." />
          <div className="text-xs text-gray-500">Programas: <b>{programs.length}</b></div>
        </div>
      </div>
      <div className="bg-white rounded shadow overflow-auto">
        {isLoading && <div className="p-6 text-sm text-gray-400">Cargando...</div>}
        {error && <div className="p-6 text-sm text-red-600">Error cargando stock.</div>}
        {!isLoading && (
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Producto</th>
                <th className="p-3 text-left">Unidad</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Valor (S/.)</th>
                {programs.map(pr => (<th key={pr} className="p-3 text-right">{getProgramLabel(pr)}</th>))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="p-3 font-bold">{String(r.name || '').toUpperCase()}</td>
                  <td className="p-3">{r.unit}</td>
                  <td className="p-3 text-right font-bold">{(r.total ?? 0).toFixed(3)}</td>
                  <td className="p-3 text-right">{(r.value ?? 0).toFixed(2)}</td>
                  {programs.map(pr => (<td key={pr} className="p-3 text-right">{Number(r.byProgram[pr] || 0).toFixed(3)}</td>))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4 + programs.length} className="p-6 text-gray-400">Sin datos.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default GlobalStockPage;

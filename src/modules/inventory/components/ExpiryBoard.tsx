
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { CalendarClock, AlertTriangle } from 'lucide-react';

type BatchRow = {
  id: string;
  product_id?: string | null;
  batch_code?: string | null;
  expiry_date?: string | null;
  quantity_current?: number | null;
};

export const ExpiryBoard = () => {
  const { programId } = useProgram();
  const [days, setDays] = useState(90);

  const { data: batches } = useQuery({
    queryKey: ['batches_expiry', programId, days],
    queryFn: async () => {
      const limit = new Date();
      limit.setDate(limit.getDate() + days);
      const { data, error } = await supabase
        .from('batches')
        .select('id, product_id, batch_code, expiry_date, quantity_current')
        .lte('expiry_date', limit.toISOString().split('T')[0]);
      if (error) throw error;
      return (data || []) as any as BatchRow[];
    },
    staleTime: 30_000,
  });

  const productIds = useMemo(() => {
    const ids = new Set<string>();
    (batches || []).forEach((b: any) => b?.product_id && ids.add(String(b.product_id)));
    return Array.from(ids);
  }, [batches]);

  const { data: productsMap } = useQuery({
    queryKey: ['products_map_for_batches', programId, productIds.join(',')],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit, program_id')
        .in('id', productIds);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => (map[String(p.id)] = p));
      return map;
    },
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const list = (batches || []).map((b: any) => {
      const p = productsMap ? (productsMap as any)[String(b.product_id)] : null;
      return {
        ...b,
        product_name: p?.name || '—',
        unit: p?.unit || '',
        program_id: p?.program_id,
      };
    });
    return list.filter((r: any) => (r.program_id ? String(r.program_id) === String(programId) : true));
  }, [batches, productsMap, programId]);

  const daysLeft = (d?: string | null) => {
    if (!d) return 9999;
    const dt = new Date(d);
    return Math.ceil((dt.getTime() - Date.now()) / 86400000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded border flex flex-wrap items-center gap-3">
        <CalendarClock className="text-blue-600" />
        <div className="font-bold text-gray-700">Tablero de Vencimientos</div>
        <div className="text-sm text-gray-500">Mostrar lotes que vencen en</div>
        <input
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 90))}
          className="border p-1 w-20 rounded text-sm"
        />
        <div className="text-sm text-gray-500">días</div>
        <div className="ml-auto text-xs text-gray-400 flex items-center gap-1">
          <AlertTriangle size={14} className="text-yellow-500" />
          Rojo ≤30d · Amarillo ≤60d
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 text-left">Producto</th>
              <th className="p-3">Lote</th>
              <th className="p-3">Vence</th>
              <th className="p-3 text-right">Disponible</th>
              <th className="p-3 text-right">Días</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const dl = daysLeft(r.expiry_date);
              const rowCls = dl <= 30 ? 'bg-red-50' : dl <= 60 ? 'bg-yellow-50' : '';
              return (
                <tr key={r.id} className={rowCls + ' border-b hover:bg-gray-50'}>
                  <td className="p-3 font-bold">
                    {r.product_name} <span className="text-xs font-normal text-gray-400">{r.unit ? `(${r.unit})` : ''}</span>
                  </td>
                  <td className="p-3 text-center font-mono text-xs">{r.batch_code || '—'}</td>
                  <td className="p-3 text-center">{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '—'}</td>
                  <td className="p-3 text-right font-bold">{Number(r.quantity_current || 0).toFixed(2)}</td>
                  <td className="p-3 text-right">{dl === 9999 ? '—' : dl}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td className="p-6 text-gray-400" colSpan={5}>No hay lotes por vencer en el rango indicado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

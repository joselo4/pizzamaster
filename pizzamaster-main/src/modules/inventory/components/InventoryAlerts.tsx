import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { AlertTriangle, Layers, ArrowDownUp, CalendarClock } from 'lucide-react';

const PCA_SUBS = ['PCA_COM', 'PCA_HOG', 'PCA_RSK'] as const;
const ALL_PROGRAMS = [...PCA_SUBS, 'PANTBC', 'OLLAS'] as const;

type Scope = 'ALL' | 'ACTIVE';

type BatchRow = {
  id: number;
  program_id: string;
  product_id: number;
  batch_code: string;
  created_at: string;
  expiry_date?: string | null;
  quantity_current?: number | null;
  input_unit_cost?: number | null;
  provider_name?: string | null;
  doc_ref?: string | null;
};

type ProductRow = { id: number; name: string; unit: string; program_id: string };

function calcDaysToExpire(expiry?: string | null) {
  if (!expiry) return null;
  const today = new Date();
  const exp = new Date(expiry);
  const ms = exp.getTime() - today.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function colorClass(days: number | null) {
  if (days === null) return 'bg-gray-50 text-gray-600';
  if (days <= 15) return 'bg-red-50 text-red-800';
  if (days <= 30) return 'bg-orange-50 text-orange-800';
  if (days <= 60) return 'bg-yellow-50 text-yellow-800';
  return '';
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return String(d);
  }
}

export const InventoryAlerts = ({ isViewer }: { isViewer: boolean }) => {
  const { programId } = useProgram();
  const [scope, setScope] = useState<Scope>('ACTIVE');
  const [q, setQ] = useState('');

  const programs = useMemo(() => (scope === 'ACTIVE' ? [programId] : [...ALL_PROGRAMS]), [scope, programId]);

  const { data: batchesRaw, isLoading, error } = useQuery({
    queryKey: ['batches_alerts_all', scope, programId],
    queryFn: async () => {
      // select('*') para no romper si el esquema no tiene columnas nuevas (doc_ref/provider_name)
      let q: any = supabase.from('batches').select('*').limit(8000);
      if (scope === 'ACTIVE') q = q.eq('program_id', programId);
      else q = q.in('program_id', programs as any);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BatchRow[];
    },
    staleTime: 30_000,
  });

// Todos los productos (incluye los que aún no tienen lotes)
const { data: productsAll } = useQuery({
  queryKey: ['products_alerts_all', scope, programId],
  queryFn: async () => {
    let q: any = supabase.from('products').select('*').limit(8000);
    if (scope === 'ACTIVE') q = q.eq('program_id', programId);
    else q = q.in('program_id', programs as any);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as any[];
  },
  staleTime: 30_000,
});


  const productIds = useMemo(() => {
    const set = new Set<number>();
    (batchesRaw || []).forEach((b: any) => {
      if (typeof b.product_id === 'number') set.add(b.product_id);
    });
    return Array.from(set);
  }, [batchesRaw]);

  const { data: productsMap } = useQuery({
    queryKey: ['products_alerts_map', scope, programId, productIds.join(',')],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id,name,unit,program_id').in('id', productIds as any).limit(8000);
      if (error) throw error;
      const map: Record<string, ProductRow> = {};
      (data || []).forEach((p: any) => (map[String(p.id)] = p));
      return map;
    },
    staleTime: 30_000,
  });

  const enriched = useMemo(() => {
    const rows = (batchesRaw || []).map((b: any) => {
      const p = (productsMap || {})[String(b.product_id)] as any;
      const days = calcDaysToExpire(b.expiry_date ?? null);
      return {
        ...b,
        product_name: p?.name || `Producto ${b.product_id}`,
        unit: p?.unit || '—',
        days,
        rowClass: colorClass(days),
      };
    });

    // FEFO (vence primero, null al final) + FIFO como desempate
    rows.sort((a: any, b: any) => {
      const ae = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.POSITIVE_INFINITY;
      const be = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.POSITIVE_INFINITY;
      if (ae !== be) return ae - be;
      const ac = new Date(a.created_at).getTime();
      const bc = new Date(b.created_at).getTime();
      return ac - bc;
    });
    return rows;
  }, [batchesRaw, productsMap]);

const productsView = useMemo(() => {
  const batches = (enriched || []) as any[];
  const byProduct: Record<string, any[]> = {};
  for (const b of batches) {
    const pid = String(b.product_id);
    (byProduct[pid] ||= []).push(b);
  }
  for (const pid of Object.keys(byProduct)) {
    byProduct[pid].sort((a,b)=> {
      const da = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.POSITIVE_INFINITY;
      const db = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });
  }
  return (productsAll || []).map((p:any)=> {
    const list = byProduct[String(p.id)] || [];
    const activeLots = list.filter(x => (x.quantity_current ?? 0) > 0);
    const next = activeLots.find(x => x.expiry_date) || activeLots[0] || list[0];
    const days = next ? calcDaysToExpire(next.expiry_date ?? null) : null;
    return {
      ...p,
      next_expiry: next?.expiry_date ?? null,
      next_batch: next?.batch_code ?? '',
      days,
      lots_count: activeLots.length,
    };
  });
}, [productsAll, enriched]);


  const suggestions = useMemo(() => {
    const avail = (enriched || []).filter((b: any) => Number(b.quantity_current || 0) > 0);
    const byProduct = new Map<number, any[]>();
    avail.forEach((b: any) => {
      const arr = byProduct.get(b.product_id) || [];
      arr.push(b);
      byProduct.set(b.product_id, arr);
    });

    const out: any[] = [];
    for (const [pid, lots] of byProduct.entries()) {
      const fifo = [...lots].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      const withExpiry = lots.filter((x) => !!x.expiry_date);
      const fefo = withExpiry.length
        ? [...withExpiry].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())[0]
        : fifo;
      out.push({ product_id: pid, product_name: fifo?.product_name || `Producto ${pid}`, unit: fifo?.unit || '—', fifo, fefo });
    }
    out.sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)));
    return out;
  }, [enriched]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow border-l-4 border-red-600">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={18} /> ALERTAS
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-gray-600">Ámbito:</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className="border rounded px-2 py-1 bg-white">
              <option value="ALL">Todos los programas</option>
              <option value="ACTIVE">Solo programa activo</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Muestra <b>TODOS</b> los lotes (sin filtrar). Orden FEFO y sugerencia FIFO.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
          Error cargando alertas: {String((error as any)?.message || error)}
        </div>
      )}

      <div className="bg-white rounded shadow border overflow-hidden">
        <div className="p-3 bg-gray-50 border-b font-bold text-gray-700 flex items-center gap-2">
          <ArrowDownUp size={16} /> Sugerencia de entrega por producto (FIFO/FEFO)
        </div>
        <div className="overflow-auto">
          

<div className="bg-white p-4 rounded border">
  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
    <div>
      <div className="font-bold text-gray-800 flex items-center gap-2"><Layers size={16}/> Productos (todos)</div>
      <div className="text-xs text-gray-500">Incluye productos sin lotes. Colores según proximidad de vencimiento (≤15 rojo, ≤30 naranja, ≤60 amarillo).</div>
    </div>
    <div className="flex gap-2">
      <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Filtrar producto..." className="border rounded px-3 py-2 text-sm w-64" />
    </div>
  </div>
  <div className="mt-3 overflow-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <th className="p-2 text-left">Producto</th>
          <th className="p-2">Unidad</th>
          <th className="p-2 text-right">Stock</th>
          <th className="p-2">Próx. Lote</th>
          <th className="p-2">Vence</th>
          <th className="p-2 text-right">Días</th>
          <th className="p-2 text-right">Lotes</th>
        </tr>
      </thead>
      <tbody>
        {(productsView || [])
          .filter((p:any)=> !q || String(p.name||'').toLowerCase().includes(q.toLowerCase()))
          .map((p:any)=> (
            <tr key={p.id} className={`border-b ${colorClass(p.days)}`}>
              <td className="p-2 font-bold">{p.name}</td>
              <td className="p-2 text-center">{p.unit || '—'}</td>
              <td className="p-2 text-right font-bold">{Number(p.stock_current ?? 0).toFixed(2)}</td>
              <td className="p-2 text-center">{p.next_batch || '—'}</td>
              <td className="p-2 text-center">{fmtDate(p.next_expiry)}</td>
              <td className="p-2 text-right font-bold">{p.days ?? '—'}</td>
              <td className="p-2 text-right">{p.lots_count ?? 0}</td>
            </tr>
          ))}
        {(!productsView || productsView.length === 0) && (
          <tr><td className="p-3 text-gray-400" colSpan={7}>Sin productos.</td></tr>
        )}
      </tbody>
    </table>
  </div>
</div>

<table className="w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase">
              <tr>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2">FIFO (ingreso)</th>
                <th className="p-2">FEFO (vence)</th>
                <th className="p-2 text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(suggestions || []).map((s: any) => (
                <tr key={s.product_id} className="hover:bg-gray-50">
                  <td className="p-2">
                    <div className="font-bold">{s.product_name}</div>
                    <div className="text-[10px] text-gray-500">Unidad: {s.unit}</div>
                  </td>
                  <td className="p-2 text-center">
                    <div className="font-bold">{s.fifo?.batch_code || '—'}</div>
                    <div className="text-[10px] text-gray-500">{fmtDate(s.fifo?.created_at)}</div>
                  </td>
                  <td className="p-2 text-center">
                    <div className="font-bold">{s.fefo?.batch_code || '—'}</div>
                    <div className="text-[10px] text-gray-500">{fmtDate(s.fefo?.expiry_date)}</div>
                  </td>
                  <td className="p-2 text-right font-bold">{Number(s.fefo?.quantity_current || s.fifo?.quantity_current || 0).toFixed(2)}</td>
                </tr>
              ))}
              {(!suggestions || suggestions.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-4 text-gray-500 text-sm">Sin lotes con stock para sugerir.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded shadow border overflow-hidden">
        <div className="p-3 bg-gray-50 border-b font-bold text-gray-700 flex items-center gap-2">
          <Layers size={16} /> Lotes (FEFO) — todos los datos ingresados
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase">
              <tr>
                <th className="p-2 text-left">Programa</th>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2">Unidad</th>
                <th className="p-2">Lote</th>
                <th className="p-2">F. ingreso</th>
                <th className="p-2">F. venc.</th>
                <th className="p-2 text-right">Días</th>
                <th className="p-2 text-right">Stock lote</th>
                <th className="p-2 text-right">Costo</th>
                <th className="p-2">Proveedor</th>
                <th className="p-2">Doc. ingreso</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(enriched || []).map((b: any) => (
                <tr key={b.id} className={`${b.rowClass} hover:bg-gray-50`}>
                  <td className="p-2 font-bold">{b.program_id}</td>
                  <td className="p-2">
                    <div className="font-bold text-gray-900">{b.product_name}</div>
                    <div className="text-[10px] text-gray-500">ID: {b.product_id}</div>
                  </td>
                  <td className="p-2 text-center font-bold">{b.unit}</td>
                  <td className="p-2 text-center font-bold">{b.batch_code}</td>
                  <td className="p-2 text-center">{fmtDate(b.created_at)}</td>
                  <td className="p-2 text-center">{fmtDate(b.expiry_date)}</td>
                  <td className="p-2 text-right font-bold">{b.days === null ? '—' : b.days}</td>
                  <td className="p-2 text-right font-bold">{Number(b.quantity_current || 0).toFixed(2)}</td>
                  <td className="p-2 text-right">{b.input_unit_cost == null ? '—' : Number(b.input_unit_cost).toFixed(2)}</td>
                  <td className="p-2">{b.provider_name || '—'}</td>
                  <td className="p-2">{b.doc_ref || '—'}</td>
                </tr>
              ))}
              {(!enriched || enriched.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={11} className="p-4 text-gray-500 text-sm">Sin lotes para mostrar.</td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={11} className="p-4 text-gray-400 text-sm">Cargando…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t bg-white text-xs text-gray-600 flex flex-wrap gap-3 items-center">
          <span className="font-bold flex items-center gap-2"><CalendarClock size={14} /> Colores por vencimiento:</span>
          <span className="px-2 py-1 rounded bg-red-50 text-red-800">≤ 30 días</span>
          <span className="px-2 py-1 rounded bg-orange-50 text-orange-800">≤ 90 días</span>
          <span className="px-2 py-1 rounded bg-yellow-50 text-yellow-800">≤ 120 días</span>
          <span className="px-2 py-1 rounded bg-gray-50 text-gray-600">Sin fecha</span>
          <span className="px-2 py-1 rounded border">&gt; 120 días</span>
        </div>
      </div>

      {isViewer && <div className="text-xs text-gray-500">Modo solo lectura: no se muestran acciones de edición aquí.</div>}
    </div>
  );
};

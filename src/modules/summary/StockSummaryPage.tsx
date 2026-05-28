import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../core/api/supabase';
import { useProgram } from '../../core/context/ProgramContext';
import { Coins, Package2, AlertTriangle, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

const PCA_SUBS = ['PCA_COM', 'PCA_HOG', 'PCA_RSK'] as const;
const ALL_PROGRAMS = [...PCA_SUBS, 'PANTBC', 'OLLAS'] as const;


type StockRow = { program_id: string; products_count: number; stock_units: number; stock_value: number; zero_items: number };

type ReachCentersRow = { program_id: string; centers_count: number; active_beneficiaries: number };

type ReachPatientsRow = { program_id: string; active_patients: number };

type TopValueRow = { id: number; name: string; unit: string; stock_current: number; average_cost: number; program_id: string };

function fmtMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `S/. ${v.toFixed(2)}`;
}

function sum(arr: any[], key: string) {
  return arr.reduce((a, x) => a + (Number((x as any)?.[key]) || 0), 0);
}


function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function exportResumenExcel(opts: { scope: string; totals: any; byProgram: any[]; top10: any[] }) {
  const { scope, totals, byProgram, top10 } = opts;
  const wb = XLSX.utils.book_new();

  const sheetTot = XLSX.utils.json_to_sheet([
    { KPI: 'Ámbito', Valor: scope },
    { KPI: 'Stock valorizado (S/.)', Valor: safeNum(totals.stock_value) },
    { KPI: 'Productos', Valor: safeNum(totals.products_count) },
    { KPI: 'Ítems en cero', Valor: safeNum(totals.zero_items) },
    { KPI: 'Centros', Valor: safeNum(totals.centers_count) },
    { KPI: 'Beneficiarios', Valor: safeNum(totals.active_beneficiaries) },
    { KPI: 'Pacientes activos', Valor: safeNum(totals.active_patients) },
  ]);
  XLSX.utils.book_append_sheet(wb, sheetTot, 'Resumen');

  const sheetByProg = XLSX.utils.json_to_sheet((byProgram ?? []).map((r: any) => ({
    Programa: r.program_id,
    Productos: safeNum(r.products_count),
    'Stock (unid)': safeNum(r.stock_units),
    'Stock valorizado': safeNum(r.stock_value),
    'Ítems en cero': safeNum(r.zero_items),
    Centros: safeNum(r.centers_count),
    Beneficiarios: safeNum(r.active_beneficiaries),
    Pacientes: safeNum(r.active_patients),
  })));
  XLSX.utils.book_append_sheet(wb, sheetByProg, 'Por programa');

  const sheetTop = XLSX.utils.json_to_sheet((top10 ?? []).map((p: any, i: number) => ({
    '#': i + 1,
    Programa: p.program_id,
    Producto: p.name,
    Unidad: p.unit,
    Stock: safeNum(p.stock_current),
    'Costo prom.': safeNum(p.average_cost),
    'Valor total': safeNum(p.stock_current) * safeNum(p.average_cost),
  })));
  XLSX.utils.book_append_sheet(wb, sheetTop, 'Top 10');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Resumen_${scope}_${date}.xlsx`);
}

export function StockSummaryPage() {
  const [viewMode, setViewMode] = React.useState<'ACTUAL' | 'GENERAL'>('ACTUAL');
  const { program, programGroup } = useProgram();

  const programList = useMemo(() => {
    if (viewMode === 'GENERAL') return [...ALL_PROGRAMS];
    return programGroup === 'PCA' ? [...PCA_SUBS] : [programGroup];
  }, [programGroup, viewMode]);

  const { data: stock } = useQuery({
    queryKey: ['v_stock_summary', programGroup],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_stock_summary').select('*').in('program_id', programList as any);
      if (error) throw error;
      return (data ?? []) as StockRow[];
    },
    staleTime: 30_000,
  });

  const { data: reachCenters } = useQuery({
    queryKey: ['v_reach_centers', programGroup],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_reach_centers').select('*').in('program_id', programList as any);
      if (error) throw error;
      return (data ?? []) as ReachCentersRow[];
    },
    staleTime: 30_000,
  });

  const { data: reachPatients } = useQuery({
    queryKey: ['v_reach_patients', programGroup],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_reach_patients').select('*').in('program_id', programList as any);
      if (error) throw error;
      return (data ?? []) as ReachPatientsRow[];
    },
    staleTime: 30_000,
  });

  

const { data: recentMovs } = useQuery({
  queryKey: ['v_recent_movements', programGroup, viewMode],
  queryFn: async () => {
    const { data, error } = await supabase.from('v_recent_movements').select('*').in('program_id', programList as any);
    if (error) throw error;
    return data || [];
  },
  staleTime: 30_000,
});

const { data: topConsumed } = useQuery({
  queryKey: ['v_top_consumed_30d', programGroup, viewMode],
  queryFn: async () => {
    const { data, error } = await supabase.from('v_top_consumed_30d').select('*').in('program_id', programList as any).limit(200);
    if (error) throw error;
    return data || [];
  },
  staleTime: 60_000,
});

const { data: topValue } = useQuery({
    queryKey: ['top_value_products', programGroup],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,unit,stock_current,average_cost,program_id')
        .in('program_id', programList as any)
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as TopValueRow[];
      rows.sort((a, b) => (b.stock_current * b.average_cost) - (a.stock_current * a.average_cost));
      return rows.slice(0, 10);
    },
    staleTime: 60_000,
  });

  const totalValue = fmtMoney(sum(stock ?? [], 'stock_value'));
  const totalProducts = sum(stock ?? [], 'products_count');
  const zeros = sum(stock ?? [], 'zero_items');

  const benef = sum(reachCenters ?? [], 'active_beneficiaries');
  const centers = sum(reachCenters ?? [], 'centers_count');
  const patients = sum(reachPatients ?? [], 'active_patients');

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow border border-gray-200">
        <h2 className="text-2xl font-black text-gray-900">Resumen</h2>
        <p className="text-xs text-gray-500 mt-1">
          Grupo: <span className="font-bold">{programGroup}</span> · Programa activo: <span className="font-bold">{program}</span>
        </p>
<div className="mt-4 flex flex-wrap gap-2 items-center">
  <button
    onClick={() => setViewMode('ACTUAL')}
    className={`px-3 py-2 rounded text-xs font-bold border ${viewMode === 'ACTUAL' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
  >
    Resumen del programa
  </button>
  <button
    onClick={() => setViewMode('GENERAL')}
    className={`px-3 py-2 rounded text-xs font-bold border ${viewMode === 'GENERAL' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
  >
    Resumen general (todos)
  </button>
  <button
    onClick={() => exportResumenExcel({
      scope: viewMode === 'GENERAL' ? 'GENERAL' : programGroup,
      totals: {
        stock_value: sum(stock ?? [], 'stock_value'),
        products_count: sum(stock ?? [], 'products_count'),
        zero_items: sum(stock ?? [], 'zero_items'),
        centers_count: sum(reachCenters ?? [], 'centers_count'),
        active_beneficiaries: sum(reachCenters ?? [], 'active_beneficiaries'),
        active_patients: sum(reachPatients ?? [], 'active_patients'),
      },
      byProgram: (programList as any[]).map((pid) => ({
        program_id: pid,
        products_count: (stock ?? []).find((x:any)=>x.program_id===pid)?.products_count ?? 0,
        stock_units: (stock ?? []).find((x:any)=>x.program_id===pid)?.stock_units ?? 0,
        stock_value: (stock ?? []).find((x:any)=>x.program_id===pid)?.stock_value ?? 0,
        zero_items: (stock ?? []).find((x:any)=>x.program_id===pid)?.zero_items ?? 0,
        centers_count: (reachCenters ?? []).find((x:any)=>x.program_id===pid)?.centers_count ?? 0,
        active_beneficiaries: (reachCenters ?? []).find((x:any)=>x.program_id===pid)?.active_beneficiaries ?? 0,
        active_patients: (reachPatients ?? []).find((x:any)=>x.program_id===pid)?.active_patients ?? 0,
      })),
      top10: topValue ?? [],
    })}
    className="px-3 py-2 rounded text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
  >
    Exportar Excel
  </button>
</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-700 text-sm font-bold"><Coins size={18}/> Stock valorizado</div>
          <div className="text-2xl font-black mt-2">{totalValue}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-700 text-sm font-bold"><Package2 size={18}/> Productos</div>
          <div className="text-2xl font-black mt-2">{totalProducts}</div>
          <div className="text-xs text-gray-500">Ítems en cero: {zeros}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-700 text-sm font-bold"><Users size={18}/> Alcance</div>
          <div className="text-2xl font-black mt-2">{programGroup === 'PANTBC' ? patients : benef}</div>
          <div className="text-xs text-gray-500">{programGroup === 'PANTBC' ? 'Pacientes activos' : `Centros: ${centers} · Benef.: ${benef}`}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-700 text-sm font-bold"><AlertTriangle size={18}/> Top valorización</div>
          <div className="text-xs text-gray-500 mt-2">Top 10 por (stock×costo)</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="font-black text-gray-900">Top valorización (incluye costos)</h3>
        <div className="overflow-auto mt-4 rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="text-left">
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Programa</th>
                <th className="py-2 px-3">Producto</th>
                <th className="py-2 px-3">Stock</th>
                <th className="py-2 px-3">Costo</th>
                <th className="py-2 px-3">Valorizado</th>
              </tr>
            </thead>
            <tbody>
              {(topValue ?? []).map((p, i) => (
                <tr key={p.id} className={i % 2 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className="py-2 px-3 font-bold">{i + 1}</td>
                  <td className="py-2 px-3 font-bold">{p.program_id}</td>
                  <td className="py-2 px-3">{p.name}</td>
                  <td className="py-2 px-3">{Number(p.stock_current ?? 0).toFixed(2)} {p.unit}</td>
                  <td className="py-2 px-3">{fmtMoney(Number(p.average_cost ?? 0))}</td>
                  <td className="py-2 px-3 font-black">{fmtMoney((Number(p.stock_current ?? 0) * Number(p.average_cost ?? 0)))}</td>
                </tr>
              ))}
              {(!topValue || topValue.length === 0) && (
                <tr><td className="py-6 px-3 text-gray-500" colSpan={6}>Sin datos para calcular top valorización.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="font-black text-gray-900">Movimientos recientes (48h)</h3>
        <p className="text-xs text-gray-500">Suma por hora: IN y OUT (vista v_recent_movements).</p>
        <div className="overflow-auto mt-3 border rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="py-2 px-3">Programa</th><th className="py-2 px-3">Hora</th><th className="py-2 px-3 text-right">IN</th><th className="py-2 px-3 text-right">OUT</th></tr></thead>
            <tbody>
              {(recentMovs ?? []).slice(0, 40).map((r:any, i:number) => (
                <tr key={i} className={i%2?'bg-white':'bg-gray-50/40'}>
                  <td className="py-2 px-3 font-bold">{r.program_id}</td>
                  <td className="py-2 px-3">{new Date(r.hour).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right">{Number(r.qty_in||0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right">{Number(r.qty_out||0).toFixed(2)}</td>
                </tr>
              ))}
              {(!recentMovs || recentMovs.length===0) && <tr><td colSpan={4} className="py-6 px-3 text-gray-500">Sin movimientos recientes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="font-black text-gray-900">Top consumo 30 días (OUT)</h3>
        <p className="text-xs text-gray-500">Vista v_top_consumed_30d (por programa).</p>
        <div className="overflow-auto mt-3 border rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="py-2 px-3">Programa</th><th className="py-2 px-3">Producto</th><th className="py-2 px-3 text-right">Qty OUT</th></tr></thead>
            <tbody>
              {(topConsumed ?? []).slice(0, 40).map((r:any, i:number) => (
                <tr key={i} className={i%2?'bg-white':'bg-gray-50/40'}>
                  <td className="py-2 px-3 font-bold">{r.program_id}</td>
                  <td className="py-2 px-3">{r.product_id}</td>
                  <td className="py-2 px-3 text-right font-bold">{Number(r.qty_out||0).toFixed(2)}</td>
                </tr>
              ))}
              {(!topConsumed || topConsumed.length===0) && <tr><td colSpan={3} className="py-6 px-3 text-gray-500">Sin datos de consumo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
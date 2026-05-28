
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../core/api/supabase';
import { useProgram } from '../../core/context/ProgramContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Printer, AlertTriangle } from 'lucide-react';
import { usePermissions2 } from '../../core/utils/permissions2';

const fmt = (v:any) => (v === null || v === undefined || v === '' ? '—' : String(v));

export const MonthlyClosure = () => {
  const { can } = usePermissions2();
  const canView = can('closure:view');
  const { programId, programName } = useProgram();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });

  const { data: products, error } = useQuery({
    queryKey: ['closure_products', programId],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('program_id', programId).order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const qc = useQueryClient();

  // Cierres recientes (monthly_closures)
  const { data: closures } = useQuery({
    queryKey: ['monthly_closures', programId],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_closures')
        .select('*')
        .eq('program_id', programId)
        .order('month', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Cerrar mes (inserta primer día del mes en monthly_closures)
  const closeMonth = useMutation({
    mutationFn: async (ym: string) => {
      const monthDate = `${ym}-01`;
      const { data, error } = await supabase
        .from('monthly_closures')
        .insert({
          program_id: programId,
          month: monthDate,
          note: 'Cierre desde UI',
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['monthly_closures', programId] });
    },
  });


  const pdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // MODO IMPRESORA MATRIZ / AUTOCOPIATIVA (alto contraste)
    doc.setFont('courier', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.text(`ACTA DE CIERRE MENSUAL — ${programName} — ${month}`, 14, 14);
    autoTable(doc, {
      startY: 18,
      head: [['Producto','Unidad','Saldo final']],
      body: (products || []).map((p:any)=> [fmt(p.name), fmt(p.unit), fmt(p.stock_current)]),
      styles: { fontSize: 9 }
    });
    const y = (doc as any).lastAutoTable?.finalY || 30;
    doc.text('Firmas (manual):', 14, y + 16);
    doc.line(20, y + 34, 90, y + 34); doc.text('Almacenero', 40, y + 40);
    doc.line(110, y + 34, 190, y + 34); doc.text('Responsable', 130, y + 40);
    doc.save(`Acta_Cierre_${programName}_${month}.pdf`);
  };

  if (!canView) {
    return <div className="bg-white p-6 rounded border"><div className="font-bold text-red-700">Acceso restringido</div><div className="text-sm text-gray-600">No tienes permiso para ver el cierre mensual.</div></div>;
  }

  return (
    <div className="space-y-6">
    <div className="bg-white p-4 rounded shadow border-l-4 border-purple-600 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800">Cierre mensual (bloqueo)</h3>
          <p className="text-xs text-gray-500">Al cerrar un mes, se bloquean movimientos del mes para el programa. ADMIN requiere OVERRIDE_CIERRE para editar.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" className="border rounded px-2 py-1 text-sm" id="month_close" />
          <button className="bg-purple-600 text-white px-3 py-2 rounded text-xs font-bold" onClick={() => { const v=(document.getElementById('month_close') as any)?.value; if(v) closeMonth.mutate(v); }}
          >Cerrar mes</button>
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-600">Cierres recientes: {(closures||[]).slice(0,5).map((c:any)=> `${c.program_id} ${String(c.month).slice(0,7)}`).join(' · ') || '—'}</div>
    </div>

    <div className="space-y-4">
      <div className="bg-white p-4 rounded border flex items-center gap-3">
        <div className="font-bold">Cierre mensual (Acta)</div>
        <input type="month" value={month} onChange={e=> setMonth(e.target.value)} className="border p-1 rounded text-sm" />
        <button onClick={pdf} className="ml-auto px-3 py-2 border rounded text-sm font-bold flex items-center gap-2"><Printer size={16}/> PDF</button>
      </div>
      {error && <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded text-sm flex items-center gap-2"><AlertTriangle size={16}/> {String((error as any)?.message||'')}</div>}
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr><th className="p-2">Producto</th><th className="p-2">Unidad</th><th className="p-2 text-right">Saldo</th></tr></thead>
          <tbody>
            {(products || []).map((p:any)=> (
              <tr key={p.id} className="border-b"><td className="p-2">{fmt(p.name)}</td><td className="p-2">{fmt(p.unit)}</td><td className="p-2 text-right font-bold">{fmt(p.stock_current)}</td></tr>
            ))}
            {(!products || products.length===0) && <tr><td className="p-4 text-gray-400" colSpan={3}>Sin datos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};

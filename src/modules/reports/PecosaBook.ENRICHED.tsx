import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../core/api/supabase';
import { useProgram } from '../../core/context/ProgramContext';
import { fetchPecosaRows, PecosaExportRow } from './pecosaData';

export default function PecosaBookEnriched() {
  const { programId } = useProgram();
  const [start, setStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0,10));

  const { data, isFetching } = useQuery({
    queryKey: ['pecosas_enriched', start, end, programId],
    queryFn: async () => fetchPecosaRows(supabase, { start, end, programId }),
    staleTime: 15_000,
  });

  const rows = useMemo(() => (data?.rows ?? []) as PecosaExportRow[], [data]);
  const source = data?.source ?? 'transactions';

  const visibleRows = rows.map(r => ({
    ...r,
    dni: r?.dni ?? '',
    phone: r?.phone ?? '',
    ubigeo: r?.ubigeo ?? '',
    department: r?.department ?? '',
    province: r?.province ?? '',
    district: r?.district ?? '',
    address: r?.address ?? '',
    health_center_name: r?.health_center_name ?? '',
    destino_center_name: r?.destino_center_name ?? '',
  }));

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(visibleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PECOSA');
    XLSX.writeFile(wb, `PECOSA_${start}_a_${end}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const head = [[
      'FECHA','PROGRAMA','TIPO','CANTIDAD','PECOSA','OBSERVACIÓN','PRODUCTO',
      'DNI','TELÉFONO','UBIGEO',
      'DEPARTAMENTO','PROVINCIA','DISTRITO','DIRECCIÓN',
      'C. SALUD (PACIENTE)','CENTRO DESTINO'
    ]];
    const body = visibleRows.map(r => ([
      r.created_at?.slice(0,10) ?? '',
      r.program_id ?? '',
      r.type ?? '',
      r.quantity ?? '',
      r.pecosa_ref ?? '',
      r.observation ?? '',
      r.product_name ?? '',
      r.dni ?? '', r.phone ?? '', r.ubigeo ?? '',
      r.department ?? '', r.province ?? '', r.district ?? '', r.address ?? '',
      r.health_center_name ?? '', r.destino_center_name ?? '',
    ]));
    autoTable(doc, {
      head,
      body,
      styles: { fontSize: 10, textColor: [0,0,0] },
      headStyles: { fontStyle: 'bold', fillColor: [240,240,240] },
      theme: 'grid',
      margin: { top: 30, left: 20, right: 20, bottom: 20 },
    });
    doc.save(`PECOSA_${start}_a_${end}.pdf`);
  };

  return (
    <div className="pecosa-root">
      <div className="mb-2 text-xs text-gray-500">Fuente: {source} · Registros: {visibleRows.length}</div>
      <div className="flex gap-2 mb-3">
        <input type="date" className="border p-1" value={start} onChange={e=>setStart(e.target.value)} />
        <input type="date" className="border p-1" value={end} onChange={e=>setEnd(e.target.value)} />
        <button className="border px-2 py-1" onClick={exportXlsx}>Exportar Excel</button>
        <button className="border px-2 py-1" onClick={exportPdf}>Exportar PDF</button>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-[12px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">FECHA</th>
              <th className="p-2 text-left">PROGRAMA</th>
              <th className="p-2 text-left">TIPO</th>
              <th className="p-2 text-left">CANTIDAD</th>
              <th className="p-2 text-left">PECOSA</th>
              <th className="p-2 text-left">OBSERVACIÓN</th>
              <th className="p-2 text-left">PRODUCTO</th>
              <th className="p-2 text-left">DNI</th>
              <th className="p-2 text-left">TELÉFONO</th>
              <th className="p-2 text-left">UBIGEO</th>
              <th className="p-2 text-left">DEPARTAMENTO</th>
              <th className="p-2 text-left">PROVINCIA</th>
              <th className="p-2 text-left">DISTRITO</th>
              <th className="p-2 text-left">DIRECCIÓN</th>
              <th className="p-2 text-left">C. SALUD (PACIENTE)</th>
              <th className="p-2 text-left">CENTRO DESTINO</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2">{r.created_at?.slice(0,10) ?? ''}</td>
                <td className="p-2">{r.program_id ?? ''}</td>
                <td className="p-2">{r.type ?? ''}</td>
                <td className="p-2">{r.quantity ?? ''}</td>
                <td className="p-2">{r.pecosa_ref ?? ''}</td>
                <td className="p-2">{r.observation ?? ''}</td>
                <td className="p-2">{r.product_name ?? ''}</td>
                <td className="p-2">{r.dni ?? ''}</td>
                <td className="p-2">{r.phone ?? ''}</td>
                <td className="p-2">{r.ubigeo ?? ''}</td>
                <td className="p-2">{r.department ?? ''}</td>
                <td className="p-2">{r.province ?? ''}</td>
                <td className="p-2">{r.district ?? ''}</td>
                <td className="p-2">{r.address ?? ''}</td>
                <td className="p-2">{r.health_center_name ?? ''}</td>
                <td className="p-2">{r.destino_center_name ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

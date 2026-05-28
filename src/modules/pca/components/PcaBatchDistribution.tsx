import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { useAuth } from '../../../core/context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FileDown, Printer, Calculator, Calendar, Send, AlertTriangle, MessageSquare, Truck, Filter, Box, Hash, Settings as SettingsIcon, ShieldAlert } from 'lucide-react';

const MONTHS_LIST = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

async function ensurePecosaAvailable(ref: string) {
  const r = String(ref||'').trim();
  if (!r) return;
  const { data } = await supabase.from('transactions').select('pecosa_ref,status').eq('pecosa_ref', r).maybeSingle();
  if (data?.pecosa_ref) throw new Error(`PECOSA ${r} ya existe (${String(data.status||'')}). Use Reimprimir.`);
}

export const PcaBatchDistribution = () => {
  const { programId, program } = useProgram();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isViewer = role === 'viewer';
  
  // ETIQUETAS DINÁMICAS (OLLAS vs PCA vs PANTBC)
  const isOllas = program === 'OLLAS';
  const labelCentro = isOllas ? 'Olla Común' : (program === 'PANTBC' ? 'Establecimiento / Paciente' : 'Comedor / Centro');
  const labelRep = isOllas ? 'Representante' : 'Presidente';
  
  // Configuración
  const [daysPerMonth, setDaysPerMonth] = useState(20);
  const [deliveryFrequency, setDeliveryFrequency] = useState('MENSUAL');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([MONTHS_LIST[new Date().getMonth()]]); 
  
  const [startPecosaNum, setStartPecosaNum] = useState<number>(0);
  const [useAutoNumber, setUseAutoNumber] = useState(true);

  // Filtros
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
  const [districtFilter, setDistrictFilter] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split('T')[0]);
  const [transportType, setTransportType] = useState('TERRESTRE');
  const [customNote, setCustomNote] = useState('');
  
  const [productsToDeliver, setProductsToDeliver] = useState<Record<number, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Queries
  const { data: signatures } = useQuery({
    queryKey: ['app_settings', programId],
    queryFn: async () => { 
        const { data } = await supabase.from('app_settings').select('*'); 
        const map:any={}; 
        data?.forEach((d:any)=>map[d.key]=d.value); 
        if (map[`pecosa_counter_${program}`]) {
            setStartPecosaNum(Number(map[`pecosa_counter_${program}`]) + 1);
        }
        return map; 
    }
  });

  const { data: centers } = useQuery({
    queryKey: ['centers_pca', programId],
    queryFn: async () => { const { data } = await supabase.from('centers').select('*').eq('program_id', programId).eq('status', 'ACTIVO').order('name'); return data || []; }
  });

  const getProduct = (rule: any) => Array.isArray(rule.products) ? rule.products[0] : rule.products;

  const { data: rules } = useQuery({
    queryKey: ['active_rules', programId],
    queryFn: async () => { 
      const { data } = await supabase.from('ration_rules').select('quantity_per_person_day, products(id, name, unit, average_cost, stock_current)').eq('program_id', programId); 
      setProductsToDeliver(prev => {
        if (Object.keys(prev).length > 0) return prev;
        const initialSelection: any = {};
        data?.forEach((r:any) => { const p = getProduct(r); if(p) initialSelection[p.id] = true; });
        return initialSelection;
      });
      return data || []; 
    }
  });

  const distritos = Array.from(new Set(centers?.map(c => c.district))).sort();
  const filteredCenters = centers?.filter(c => !districtFilter || c.district === districtFilter);
  const totalDaysCalc = daysPerMonth * selectedMonths.length;

  const toggleMonth = (month: string) => {
    if (selectedMonths.includes(month)) setSelectedMonths(selectedMonths.filter(m => m !== month));
    else setSelectedMonths([...selectedMonths, month]);
  };

  const calculateDistribution = (center: any) => {
    return rules?.map((rule: any) => {
      const prod = getProduct(rule);
      if (!prod) return { product_id: 0, product_name: 'ERROR', unit: '-', qty: 0, cost_unit: 0, hasStock: false, stock_current: 0 };
      const isSelected = productsToDeliver[prod.id];
      const totalQty = isSelected ? (center.active_beneficiaries * rule.quantity_per_person_day * totalDaysCalc) : 0;
      return {
        product_id: prod.id, product_name: prod.name, unit: prod.unit,
        qty: totalQty, cost_unit: prod.average_cost, 
        hasStock: !isSelected || totalQty === 0 || (prod.stock_current >= totalQty),
        stock_current: prod.stock_current
      };
    }) || [];
  };

  const exportToExcel = () => {
    if (selectedCenters.length === 0) return alert('Seleccione al menos un centro');
    const wb = XLSX.utils.book_new();
    const allData: any[] = [];
    filteredCenters?.filter(c => selectedCenters.includes(c.id)).forEach(center => {
      const items = calculateDistribution(center);
      items.forEach(item => {
        if(item.qty > 0) {
            allData.push({
                FECHA: dispatchDate, LLEGADA: arrivalDate, TRANSPORTE: transportType,
                CENTRO: center.name, DISTRITO: center.district,
                BENEFICIARIOS: center.active_beneficiaries, DIAS_TOTALES: totalDaysCalc,
                PERIODO: selectedMonths.join('-'), PRODUCTO: item.product_name, UNIDAD: item.unit,
                CANTIDAD: item.qty, COSTO_UNIT: item.cost_unit, COSTO_TOTAL: item.qty * item.cost_unit
            });
        }
      });
    });
    const ws = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(wb, ws, "Distribucion");
    XLSX.writeFile(wb, `Reporte_${program}_${selectedMonths.join('_')}.xlsx`);
  };

  const generateBatchPDF = (specificCenters: any[] | null = null) => {
    const list = specificCenters || filteredCenters?.filter(c => selectedCenters.includes(c.id));
    if (!list || list.length === 0) return alert('Seleccione centros');

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // MODO IMPRESORA MATRIZ / AUTOCOPIATIVA (alto contraste)
    doc.setFont('courier', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.4);
    const solicitante = isOllas ? (signatures?.['ollas_solicitante'] || 'RESP. OLLAS') : (signatures?.['pca_solicitante'] || 'RESPONSABLE PROGRAMA');
    const distribuidor = signatures?.['pca_distribuidor'] || 'JEFE ALMACEN';
    const periodText = `${deliveryFrequency}: ${selectedMonths.join(', ')} (${daysPerMonth} días c/u)`;

    list.forEach((center, index) => {
      if (index > 0) doc.addPage();
      const items = calculateDistribution(center);
      
      doc.setFontSize(14); doc.text('MUNICIPALIDAD PROVINCIAL DE ANDAHUAYLAS', 105, 15, { align: 'center' });
      doc.setFontSize(10); doc.text(`PECOSA DE SALIDA - ${program}`, 105, 22, { align: 'center' });
      
      const finalPecosaNum = useAutoNumber ? `${new Date().getFullYear()}-${String(startPecosaNum + index).padStart(4, '0')}` : `MANUAL-${center.id}`;
      
      doc.setFont('courier', 'bold'); doc.text(`PECOSA N°: ${finalPecosaNum}`, 150, 22); doc.setFont('courier', 'normal');
      doc.setFontSize(8); doc.rect(14, 28, 182, 30);
      
      doc.text(`SOLICITANTE:`, 16, 33); doc.text(solicitante, 50, 33);
      doc.text(`FECHA EMISIÓN:`, 120, 33); doc.text(dispatchDate, 150, 33);
      doc.text(`RESP. ALMACÉN:`, 16, 38); doc.text(distribuidor, 50, 38);
      doc.text(`FECHA LLEGADA:`, 120, 38); doc.text(arrivalDate, 150, 38);
      doc.text(`TRANSPORTE:`, 16, 43); doc.text(transportType, 50, 43);
      doc.text(`NOTA:`, 16, 50); doc.text(customNote || '---', 50, 50);

      doc.rect(14, 62, 182, 35);
      // Lógica dinámica para etiquetas OLLAS/PANTBC
      doc.text(`DESTINO:`, 16, 67); doc.setFont('courier', 'bold'); doc.text(center.name, 50, 67); doc.setFont('courier', 'normal');
      
      if (!isOllas) {
         doc.text(`RESOLUCIÓN:`, 120, 67); doc.text(center.resolution_number || '---', 145, 67);
      }
      
      doc.text(`${labelRep}:`, 16, 72); doc.text(center.president_name || '', 50, 72);
      doc.text(`DNI:`, 120, 72); doc.text(center.president_dni || '', 145, 72);
      
      doc.text(`PERIODO:`, 16, 77); doc.text(periodText, 50, 77);
      doc.text(`TOTAL DÍAS:`, 16, 82); doc.text(`${totalDaysCalc} días efectivos`, 50, 82);
      doc.text(`BENEFICIARIOS:`, 120, 82); doc.text(String(center.active_beneficiaries), 145, 82);
      
      // Mostrar C.S. si es PANTBC
      const locationText = `${center.district} - ${center.address || center.place || ''}`;
      doc.text(`UBICACIÓN:`, 16, 90); doc.text(locationText, 50, 90);

      const tableBody = items.filter(i => i.qty > 0).map((i, idx) => [ idx + 1, i.product_name, i.unit, i.qty.toFixed(2), `S/. ${i.cost_unit?.toFixed(4)}`, `S/. ${(i.qty * i.cost_unit).toFixed(2)}` ]);
      autoTable(doc, {
        startY: 100,
        head: [['IT', 'PRODUCTO', 'UNIDAD', 'CANTIDAD', 'P. UNIT', 'TOTAL']],
        body: tableBody,
        theme: 'grid',
        margin: { left: 10, right: 10 },
        styles: { font: 'courier', fontSize: 9, cellPadding: 1, textColor: 0, lineColor: 0, lineWidth: 0.35 },
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', lineColor: 0, lineWidth: 0.35 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 78 },
          2: { cellWidth: 16 },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 24, halign: 'right' },
          5: { cellWidth: 24, halign: 'right' },
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 40;
      doc.line(20, finalY, 80, finalY); doc.text('ALMACÉN / ENTREGA', 35, finalY + 5);
      doc.line(120, finalY, 180, finalY); doc.text('RECIBI CONFORME', 135, finalY + 5);
    });
    doc.save(`${program}_${selectedMonths.join('-')}_Oficial.pdf`);
  };

  const handleProcess = useMutation({
    mutationFn: async () => {
      if (isViewer) throw new Error("Modo solo lectura: No puede procesar salidas.");
      
      setIsProcessing(true);
      const centersToProcess = filteredCenters?.filter(c => selectedCenters.includes(c.id));
      if (!centersToProcess?.length) throw new Error("Seleccione centros");
      
      const movements: any[] = [];
      const periodText = `${deliveryFrequency}: ${selectedMonths.join(', ')}`;
      let currentPecosa = startPecosaNum;
      
      const totalDemand: Record<number, number> = {};
      
      // Validación estricta para evitar negativos futuros
      for (const center of centersToProcess) {
          const items = calculateDistribution(center);
          items.forEach(i => {
              if (i.qty > 0) {
                  totalDemand[i.product_id] = (totalDemand[i.product_id] || 0) + i.qty;
                  if (i.qty > i.stock_current) throw new Error(`Stock insuficiente para ${center.name}. Req: ${i.qty}, Stock: ${i.stock_current}`);
              }
          });
      }
      rules?.forEach((r:any) => {
          const p = getProduct(r);
          if (p && totalDemand[p.id] > p.stock_current) throw new Error(`STOCK GLOBAL INSUFICIENTE: ${p.name}. Total Req: ${totalDemand[p.id]}, Stock: ${p.stock_current}`);
      });

      for (const center of centersToProcess) {
        const items = calculateDistribution(center);
        const pecosaString = useAutoNumber ? `${new Date().getFullYear()}-${String(currentPecosa).padStart(4, '0')}` : `MANUAL-${center.id}`;
        items.forEach(i => { 
          if (i.qty > 0) movements.push({ type: 'OUT', program_id: programId, product_id: i.product_id, center_id: center.id, quantity: i.qty, created_at: new Date().toISOString(), pecosa_ref: pecosaString, observation: (customNote || `ENTREGA ${periodText}`) + ` | FECHA:${dispatchDate}` });
        });
        if (useAutoNumber) currentPecosa++;
      }

      const { error } = await supabase.from('movements').insert(movements);
      if (error) throw error;
      if (useAutoNumber) await supabase.from('app_settings').upsert({ key: `pecosa_counter_${program}`, value: String(currentPecosa - 1) }, { onConflict: 'key' });
      return centersToProcess; 
    },
    onSuccess: (centersToProcess) => { 
      if (centersToProcess) generateBatchPDF(centersToProcess);
      alert('Salida procesada correctamente. Inventario actualizado.'); 
      setSelectedCenters([]); 
      setIsProcessing(false); 
      queryClient.invalidateQueries({queryKey:['active_rules']}); 
      queryClient.invalidateQueries({queryKey:['products']});
      queryClient.invalidateQueries({ queryKey: ['kardex500', programId] });
      queryClient.invalidateQueries({ queryKey: ['movements', programId] });
    },
    onError: (e: any) => { alert(e.message); setIsProcessing(false); }
  });

  const toggleAll = () => { if (selectedCenters.length === filteredCenters?.length) setSelectedCenters([]); else setSelectedCenters(filteredCenters?.map(c => c.id) || []); };
  const toggleProduct = (id: number) => { setProductsToDeliver(prev => ({...prev, [id]: !prev[id]})); };

  return (
    <div className="space-y-6 animate-fade-in">
      {isViewer && (
         <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded shadow-sm flex items-center gap-3">
            <ShieldAlert size={24}/>
            <div>
               <p className="font-bold">Modo Visualización</p>
               <p className="text-xs">Puede generar reportes y vistas previas, pero no puede procesar salidas de almacén.</p>
            </div>
         </div>
      )}

      <div className="bg-white p-6 rounded shadow border-l-4 border-blue-600">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Calculator className="text-blue-600"/> Distribución: {program}</h3>
        
        {/* CONFIG DE PERIODO */}
        <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-4">
            <h4 className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-2"><Calendar size={14}/> CONFIGURACIÓN DE ENTREGA</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className="text-[10px] font-bold text-gray-500">FRECUENCIA</label><select className="w-full border p-2 rounded text-sm bg-white" value={deliveryFrequency} onChange={e => setDeliveryFrequency(e.target.value)}><option value="MENSUAL">MENSUAL</option><option value="BIMESTRAL">BIMESTRAL</option><option value="TRIMESTRAL">TRIMESTRAL</option></select></div>
                <div><label className="text-[10px] font-bold text-gray-500">DÍAS/MES</label><input type="number" value={daysPerMonth} onChange={e => setDaysPerMonth(Number(e.target.value))} className="w-full border p-2 rounded text-center font-bold bg-white text-blue-800" /></div>
                <div className="md:col-span-2"><label className="text-[10px] font-bold text-gray-500 block mb-1">MESES A ATENDER</label><div className="flex flex-wrap gap-2">{MONTHS_LIST.map(m => (<button key={m} onClick={() => toggleMonth(m)} className={`text-[10px] px-2 py-1 rounded border ${selectedMonths.includes(m) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>{m.substring(0,3)}</button>))}</div></div>
            </div>
        </div>

        {/* FILTROS Y DATOS DE ENVÍO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded border">
          <div className="md:col-span-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Filter size={12}/> DISTRITO</label><select className="w-full border p-2 rounded text-sm bg-white" value={districtFilter} onChange={e => setDistrictFilter(e.target.value)}><option value="">-- TODOS --</option>{distritos.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="md:col-span-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Calendar size={12}/> FECHA EMISIÓN</label><input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} className="w-full border p-2 rounded bg-white text-sm" /></div>
          
          <div className="md:col-span-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Truck size={12}/> FECHA LLEGADA</label><input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} className="w-full border p-2 rounded bg-white text-sm" /></div>
          <div className="md:col-span-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Truck size={12}/> TRANSPORTE</label><select value={transportType} onChange={e => setTransportType(e.target.value)} className="w-full border p-2 rounded text-sm bg-white"><option value="TERRESTRE">TERRESTRE</option><option value="FLUVIAL">FLUVIAL</option><option value="AÉREO">AÉREO</option><option value="ACÉMILA">ACÉMILA</option></select></div>

          <div className="md:col-span-2 bg-yellow-50 p-2 rounded border border-yellow-200 mt-2">
             <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-yellow-800 flex items-center gap-1"><SettingsIcon size={12}/> PECOSA</label>
                <div className="flex items-center gap-2"><span className="text-[9px] text-gray-500">Auto</span><input type="checkbox" checked={useAutoNumber} onChange={e => setUseAutoNumber(e.target.checked)} /></div>
             </div>
             {useAutoNumber ? (
                 <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Inicia:</span><input type="number" className="w-24 border p-1 rounded font-bold text-center" value={startPecosaNum} onChange={e => setStartPecosaNum(Number(e.target.value))} /><span className="text-xs text-gray-500 flex items-center gap-1"><Hash size={10}/> Correlativo</span></div>
             ) : (<input className="w-full border p-1 rounded text-sm placeholder-gray-400" placeholder="Manual" disabled />)}
          </div>

          <div className="md:col-span-4 border-t pt-3 mt-2">
             <label className="text-[10px] font-bold text-blue-600 flex items-center gap-1 mb-2"><Box size={12}/> SELECCIÓN DE ALIMENTOS</label>
             <div className="flex flex-wrap gap-3">
               {rules?.map((r: any) => { const p = getProduct(r); if (!p) return null; return ( <label key={p.id} className="flex items-center gap-2 bg-white px-3 py-1 rounded border shadow-sm cursor-pointer hover:bg-blue-50 transition select-none"><input type="checkbox" checked={productsToDeliver[p.id] || false} onChange={() => toggleProduct(p.id)} className="w-4 h-4 text-blue-600"/><div><div className="text-xs font-bold text-gray-700">{p.name}</div><div className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded w-fit">{p.stock_current} {p.unit}</div></div></label> ); })}
             </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end mb-4 p-4 bg-gray-50 rounded border border-t-0 -mt-4">
           <div className="flex-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><MessageSquare size={12}/> NOTA ADICIONAL</label><input value={customNote} onChange={e => setCustomNote(e.target.value)} className="w-full border p-2 rounded bg-white text-sm" placeholder="Observaciones..." /></div>
           <div className="flex gap-2">
              <button onClick={() => exportToExcel()} className="bg-white border border-green-600 text-green-700 px-4 py-2 rounded font-bold hover:bg-green-50 flex items-center gap-2 text-xs"><FileDown size={18} /> EXCEL</button>
              <button onClick={() => generateBatchPDF()} className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-black flex gap-2 text-xs"><Printer size={18}/> VISTA PREVIA</button>
              <button disabled={isViewer || isProcessing || selectedCenters.length===0} onClick={() => handleProcess.mutate()} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 flex gap-2 text-xs shadow disabled:bg-gray-400 disabled:cursor-not-allowed"><Send size={18}/> {isProcessing ? 'PROCESANDO...' : 'PROCESAR SALIDA'}</button>
           </div>
        </div>

        <div className="overflow-x-auto border rounded bg-white max-h-[400px]">
          <table className="w-full text-sm">
             <thead className="bg-gray-200 sticky top-0 uppercase text-xs"><tr><th className="p-3 w-10"><input type="checkbox" onChange={toggleAll} checked={selectedCenters.length>0 && selectedCenters.length===filteredCenters?.length}/></th><th className="p-3 text-left">{labelCentro}</th><th className="p-3 text-center">Beneficiarios</th><th className="p-3 text-center">Raciones</th><th className="p-3 text-center">Estado Stock</th></tr></thead>
             <tbody>
               {filteredCenters?.map(c => {
                 const items = calculateDistribution(c);
                 const missing = items.find(i => !i.hasStock); 
                 return (
                   <tr key={c.id} className={`hover:bg-blue-50 border-b ${missing ? 'bg-red-50' : ''}`}>
                     <td className="p-3"><input type="checkbox" checked={selectedCenters.includes(c.id)} onChange={(e) => e.target.checked ? setSelectedCenters([...selectedCenters, c.id]) : setSelectedCenters(selectedCenters.filter(id=>id!==c.id))} /></td>
                     <td className="p-3"><div className="font-bold">{c.name}</div><div className="text-xs text-gray-500">{c.district}</div></td>
                     <td className="p-3 text-center font-bold text-gray-700">{c.active_beneficiaries}</td>
                     <td className="p-3 text-center font-bold text-blue-800">{c.active_beneficiaries * totalDaysCalc}</td>
                     <td className="p-3 text-center">{missing ? <span className="text-red-600 font-bold text-[10px] flex justify-center gap-1"><AlertTriangle size={12}/> Falta {missing.product_name}</span> : <span className="text-green-600 font-bold text-[10px] bg-green-100 px-2 rounded">OK</span>}</td>
                   </tr>
                 );
               })}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
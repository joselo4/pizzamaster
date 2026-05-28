import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// LIMPIEZA: Eliminados Edit3 y AlertTriangle
import { CheckCircle, XCircle, ShoppingCart, Save, Printer, Package, FileText, Tag, AlertTriangle } from 'lucide-react';

async function ensurePecosaAvailable(ref: string) {
  const r = String(ref||'').trim();
  if (!r) return;
  const { data } = await supabase.from('transactions').select('pecosa_ref,status').eq('pecosa_ref', r).maybeSingle();
  if (data?.pecosa_ref) throw new Error(`PECOSA ${r} ya existe (${String(data.status||'')}). Use Reimprimir.`);
}

export const KitDelivery = ({ patient }: { patient: any }) => {
  const { programId } = useProgram();
  const queryClient = useQueryClient();
  const safe = (v: any) => String(v ?? '').trim();
  
  const [currentDate] = useState(new Date());
  const [customItems, setCustomItems] = useState<any[]>([]); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastDelivery, setLastDelivery] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState('');

  // Cargar Firmas
  const { data: signatures } = useQuery({ queryKey: ['app_settings_pantbc'], queryFn: async () => { const { data } = await supabase.from('app_settings').select('*'); const map:any={}; data?.forEach((d:any)=>map[d.key]=d.value); return map; } });
  
  // Validar Adherencia
  const { data: compliance } = useQuery({ queryKey: ['compliance_check', patient?.id], enabled: !!patient?.id, queryFn: async () => { const { data } = await supabase.from('pantbc_compliance').select('status').eq('patient_id', patient.id).eq('month', currentDate.getMonth()+1).eq('year', currentDate.getFullYear()).single(); return data?.status || 'PENDIENTE'; } });
  
  // Receta
  const { data: kitItems, isLoading: loadingKit } = useQuery({ queryKey: ['kit_recipe', patient?.assigned_kit_id], enabled: !!patient?.assigned_kit_id, queryFn: async () => { const { data } = await supabase.from('kit_items').select('quantity, products(id, name, unit, stock_current, average_cost)').eq('kit_id', patient.assigned_kit_id); return data || []; } });

  useEffect(() => { if (kitItems) setCustomItems(kitItems.map((item: any) => ({ ...item, product_id: item.products.id, name: item.products.name, unit: item.products.unit, stock: item.products.stock_current, avg_cost: item.products.average_cost, delivery_qty: item.quantity, selected: true }))); }, [kitItems]);

  const toggleSelect = (idx: number) => { const updated = [...customItems]; updated[idx].selected = !updated[idx].selected; setCustomItems(updated); };

  const deliveryMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      const itemsToDeliver = customItems.filter(i => i.selected && i.delivery_qty > 0);
      if (itemsToDeliver.length === 0) throw new Error("Sin items.");
      
      const movements: any[] = [];
      const batchUpdates: any[] = [];

      // FEFO LÓGICA
      for (const item of itemsToDeliver) {
        let qtyNeed = item.delivery_qty;
        // Buscar lotes
        const { data: batches } = await supabase.from('batches').select('*').eq('product_id', item.product_id).gt('quantity_current', 0).order('expiry_date', { ascending: true });
        
        let batchIndex = 0;
        while (qtyNeed > 0) {
           const batch = batches && batches[batchIndex] ? batches[batchIndex] : null;
           const take = batch ? Math.min(qtyNeed, batch.quantity_current) : qtyNeed;

           movements.push({
             type: 'OUT', program_id: programId, patient_id: patient.id, product_id: item.product_id, batch_id: batch?.id, quantity: take, pecosa_ref: `ENTREGA-${patient.dni}`, observation: deliveryNote || `ENTREGA PANTBC`, created_at: new Date().toISOString()
           });

           if (batch) {
             batchUpdates.push({ id: batch.id, quantity_current: batch.quantity_current - take });
             batchIndex++;
           }
           qtyNeed -= take;
        }
      }

      const { error } = await supabase.from('movements').insert(movements);
      if (error) throw error;
      for (const u of batchUpdates) await supabase.from('batches').update({ quantity_current: u.quantity_current }).eq('id', u.id);
    },
    onSuccess: () => { setLastDelivery(new Date().toISOString()); alert('Entrega registrada.'); setIsProcessing(false); queryClient.invalidateQueries({queryKey:['kit_recipe']}); },
    onError: (e:any) => { alert(e.message); setIsProcessing(false); }
  });

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      // --- DATOS DEL PACIENTE (PANTBC) ---
      try {
        let y = 22;
        doc.setFontSize(11);
        doc.text('DATOS DEL PACIENTE', 14, y);
        doc.setFontSize(9);
        y += 6;
        doc.text(`Nombre: ${safe(patient?.name)}`, 14, y);
        y += 5;
        doc.text(`DNI: ${safe(patient?.dni)}    Tel: ${safe(patient?.phone)}`, 14, y);
        y += 5;
        const r = safe(patient?.region);
        const p = safe(patient?.province);
        const d = safe(patient?.district);
        if (r || p || d) { doc.text(`Reg/Prov/Dist: ${r} / ${p} / ${d}`, 14, y); y += 5; }
        const hc = safe((patient as any)?.health_center || (patient as any)?.health_center_name);
        const off = safe((patient as any)?.report_officio_number);
        if (hc || off) { doc.text(`Centro: ${hc}    Oficio: ${off}`, 14, y); y += 5; }
        const addr = safe(patient?.address);
        if (addr) { doc.text(`Dirección: ${addr}`, 14, y); y += 5; }
        const ub = safe(patient?.ubigeo);
        if (ub) { doc.text(`UBIGEO: ${ub}`, 14, y); y += 5; }
      } catch {}


    // MODO IMPRESORA MATRIZ / AUTOCOPIATIVA (alto contraste)
    doc.setFont('courier', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.4);
    const itemsDelivered = customItems.filter(i => i.selected && i.delivery_qty > 0);
    const solicitante = signatures?.['pantbc_solicitante'] || 'RESPONSABLE TBC';
    const distribuidor = signatures?.['pantbc_distribuidor'] || 'ALMACÉN';

    doc.setFontSize(14); doc.text('MUNICIPALIDAD PROVINCIAL DE ANDAHUAYLAS', 105, 15, { align: 'center' });
    doc.setFontSize(10); doc.text('PECOSA DE SALIDA - PANTBC', 105, 22, { align: 'center' });
    
    doc.setFontSize(8); doc.rect(14, 28, 182, 35);
    doc.text(`SOLICITANTE:`, 16, 33); doc.text(solicitante, 50, 33);
    doc.text(`FECHA:`, 120, 33); doc.text(new Date().toLocaleDateString(), 150, 33);
    doc.text(`RESP. ALMACÉN:`, 16, 38); doc.text(distribuidor, 50, 38);
    
    doc.text(`BENEFICIARIO:`, 16, 48); doc.setFont("helvetica", "bold"); doc.text(patient.full_name, 50, 48); doc.setFont("helvetica", "normal");
    doc.text(`DNI:`, 120, 48); doc.text(patient.dni, 150, 48);
    doc.text(`C. SALUD:`, 16, 53); doc.text(patient.centers?.name || '---', 50, 53);
    doc.text(`NOTA:`, 16, 58); doc.text(deliveryNote || 'ENTREGA REGULAR', 50, 58);

    const tableBody = itemsDelivered.map((i, idx) => [ idx + 1, i.name, i.unit, i.delivery_qty.toFixed(2), `S/. ${i.avg_cost?.toFixed(4)}`, `S/. ${(i.delivery_qty * i.avg_cost).toFixed(2)}` ]);
    autoTable(doc, {
      styles: { font: 'courier', fontSize: 9, cellPadding: 1, textColor: 0, lineColor: 0, lineWidth: 0.35 },
      headStyles: { fillColor: [255,255,255], textColor: 0, fontStyle: 'bold', lineColor: 0, lineWidth: 0.35 },
 startY: 65, head: [['IT', 'PRODUCTO', 'UNIDAD', 'CANTIDAD', 'P. UNIT', 'TOTAL']], body: tableBody, theme: 'grid' });

    const finalY = (doc as any).lastAutoTable.finalY + 40;
    doc.line(20, finalY, 80, finalY); doc.text('ENTREGUE CONFORME', 30, finalY + 5);
    doc.line(120, finalY, 180, finalY); doc.text('RECIBI CONFORME', 135, finalY + 5); doc.text(patient.full_name, 130, finalY + 10);
    doc.save(`PECOSA_TBC_${patient.dni}.pdf`);
  };

  if (!patient || !patient.id) return <div className="bg-gray-50 border-2 border-dashed rounded-lg p-8 text-center text-gray-400"><Package className="mx-auto mb-2 opacity-50"/><p>Seleccione un paciente.</p></div>;
  if (compliance !== 'CUMPLIO') return <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center animate-pulse"><XCircle className="text-red-500 mx-auto mb-2" size={32}/><h3 className="text-lg font-bold text-red-800">ENTREGA BLOQUEADA</h3><p className="text-red-700">Sin asistencia.</p></div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-blue-200 overflow-hidden">
      <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between">
        <div><h3 className="font-bold text-blue-900 flex items-center gap-2"><ShoppingCart size={18}/> Despacho de Kit</h3><p className="text-sm text-blue-700">Paciente: <strong>{patient.full_name}</strong></p></div>
        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded h-fit flex items-center gap-1"><CheckCircle size={12}/> HABILITADO</span>
      </div>
      <div className="p-4">
        {loadingKit ? <p className="text-center text-gray-400">Cargando...</p> : customItems.length===0 ? <div className="text-center text-gray-400 py-4"><Package className="mx-auto mb-2 opacity-20"/><p>Sin Kit.</p></div> : (
          <div className="space-y-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs"><tr><th className="p-2 w-10">Sel.</th><th className="p-2 text-left">Producto</th><th className="p-2 text-right">Stock</th><th className="p-2 text-center w-24">Entrega</th></tr></thead>
              <tbody className="divide-y">{customItems.map((item, idx) => (
                <tr key={item.product_id} className={!item.selected ? 'opacity-50' : ''}>
                  <td className="p-2 text-center"><input type="checkbox" checked={item.selected} onChange={() => toggleSelect(idx)} /></td>
                  <td className="p-2 font-medium">{item.name}</td>
                  <td className={`p-2 text-right font-mono ${item.selected && item.stock < item.delivery_qty ? 'text-red-600 font-bold' : ''}`}>{item.stock.toFixed(2)}</td>
                  <td className="p-2"><input type="number" disabled={!item.selected} className="w-full border rounded p-1 text-center font-bold" value={item.delivery_qty} onChange={(e) => { const u = [...customItems]; u[idx].delivery_qty = Number(e.target.value); setCustomItems(u); }} /></td>
                </tr>))}</tbody>
            </table>
            <div className="bg-gray-50 p-3 rounded border">
              <div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-gray-500 flex gap-1"><FileText size={12}/> NOTA</label><span className="text-[10px] text-blue-600 flex items-center gap-1"><Tag size={10}/> FEFO AUTO</span></div>
              <input value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} className="w-full border p-2 rounded bg-white mb-3 text-sm" placeholder="Observaciones..." />
              <div className="flex gap-2">
                <button onClick={() => deliveryMutation.mutate()} disabled={isProcessing || customItems.some(i=>i.selected && i.stock<i.delivery_qty)} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold shadow hover:bg-blue-700 disabled:bg-gray-400 flex justify-center gap-2"><Save size={18}/> SALIDA</button>
                {lastDelivery && <button onClick={generatePDF} className="bg-gray-800 text-white px-4 rounded font-bold hover:bg-black flex gap-2"><Printer size={18}/> PECOSA</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

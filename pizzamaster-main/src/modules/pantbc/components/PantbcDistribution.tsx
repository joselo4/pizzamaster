import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { useAuth } from '../../../core/context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Search, ShoppingBag, Send, Printer, UserCheck, AlertTriangle, Hash, MessageSquare, ChevronDown } from 'lucide-react';

async function ensurePecosaAvailable(ref: string) {
  const r = String(ref||'').trim();
  if (!r) return;
  const { data } = await supabase.from('transactions').select('pecosa_ref,status').eq('pecosa_ref', r).maybeSingle();
  if (data?.pecosa_ref) throw new Error(`PECOSA ${r} ya existe (${String(data.status||'')}). Use Reimprimir.`);
}

export const PantbcDistribution = () => {
  const { programId } = useProgram();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isViewer = role === 'viewer';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [startPecosa, setStartPecosa] = useState(0);
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [customNote, setCustomNote] = useState('ENTREGA MENSUAL PANTBC');
  
  // NUEVO: Estado para seleccionar qué Kit entregar (si hay varios)
  const [selectedKitId, setSelectedKitId] = useState<number | null>(null);

  // 1. CARGAR CONFIGURACIÓN Y FIRMAS (Para la PECOSA Oficial)
  const { data: signatures } = useQuery({
    queryKey: ['settings_pantbc'],
    queryFn: async () => { 
        const { data } = await supabase.from('app_settings').select('*');
        const map:any = {};
        data?.forEach((d:any) => map[d.key] = d.value);
        
        // Cargar correlativo
        const count = map['pecosa_counter_PANTBC'] || '0';
        setStartPecosa(parseInt(count) + 1);
        return map; 
    }
  });

  // 2. CARGAR LISTA DE KITS DISPONIBLES
  const { data: kitsList } = useQuery({
    queryKey: ['kits_list_dist', programId],
    queryFn: async () => { 
      const { data } = await supabase.from('kits').select('*').eq('program_id', programId).order('name'); 
      return data || []; 
    }
  });

  // Efecto para auto-seleccionar el primer kit
  useEffect(() => {
    if (kitsList && kitsList.length > 0 && !selectedKitId) {
        setSelectedKitId(kitsList[0].id);
    }
  }, [kitsList]);

  // 3. CARGAR ITEMS DEL KIT SELECCIONADO (Ahora sí desde la tabla correcta)
  const { data: kitItems } = useQuery({
    queryKey: ['kit_items_dist', selectedKitId],
    enabled: !!selectedKitId,
    queryFn: async () => { 
        // Traemos items y datos del producto
        const { data } = await supabase.from('kit_items')
          .select('quantity, products(id, name, unit, stock_current, average_cost)')
          .eq('kit_id', selectedKitId);
        
        // Formateamos para facilitar uso
        return data?.map((i:any) => ({
            product_id: i.products.id,
            name: i.products.name,
            unit: i.products.unit,
            qty: i.quantity,
            cost: i.products.average_cost,
            stock: i.products.stock_current
        })) || []; 
    }
  });

  // 4. CARGAR PACIENTES
  const { data: patients } = useQuery({
    queryKey: ['patients_dist', programId],
    queryFn: async () => { const { data } = await supabase.from('patients').select('*').eq('program_id', programId).eq('status', 'ACTIVO').order('name'); return data || []; },
    staleTime: 0 
  });

  // FILTRO
  const filteredPatients = patients?.filter(p => 
    p.name.includes(searchTerm.toUpperCase()) || 
    p.dni?.includes(searchTerm) ||
    p.health_center?.includes(searchTerm.toUpperCase())
  );

  // --- GENERACIÓN PECOSA (PDF ESTILO COMEDORES) ---
  const generatePecosas = (patientsList: any[]) => {
    if (patientsList.length === 0) return alert("No hay pacientes seleccionados.");
    
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // MODO IMPRESORA MATRIZ / AUTOCOPIATIVA (alto contraste)
    doc.setFont('courier', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.4);
    const solicitante = signatures?.['pca_solicitante'] || 'RESPONSABLE PANTBC'; // Reusa la firma de PCA o crea una nueva key si prefieres
    const distribuidor = signatures?.['pca_distribuidor'] || 'JEFE ALMACEN';

    patientsList.forEach((patient, index) => {
        if (index > 0) doc.addPage();
        const pecosaNum = `${new Date().getFullYear()}-${String(startPecosa + index).padStart(4, '0')}`;

        // 1. ENCABEZADO
        doc.setFontSize(14); doc.text('MUNICIPALIDAD PROVINCIAL DE ANDAHUAYLAS', 105, 15, { align: 'center' });
        doc.setFontSize(10); doc.text('PROGRAMA PANTBC - PECOSA DE SALIDA', 105, 22, { align: 'center' });
        doc.setFont("helvetica", "bold"); doc.text(`PECOSA N°: ${pecosaNum}`, 150, 22); doc.setFont("helvetica", "normal");

        // 2. BLOQUE SUPERIOR (DATOS ADMINISTRATIVOS)
        doc.setFontSize(8); 
        doc.rect(14, 28, 182, 25); // Caja Superior

        doc.text(`SOLICITANTE:`, 16, 33); doc.text(solicitante, 45, 33);
        doc.text(`FECHA EMISIÓN:`, 120, 33); doc.text(dispatchDate, 150, 33);

        doc.text(`RESP. ALMACÉN:`, 16, 38); doc.text(distribuidor, 45, 38);
        doc.text(`DESTINO FINAL:`, 120, 38); doc.text('CONSUMO HUMANO - PCA', 150, 38);

        doc.text(`NOTA:`, 16, 43); doc.text(customNote, 45, 43);

        // 3. BLOQUE INFERIOR (DATOS DEL PACIENTE/DESTINO)
        doc.rect(14, 55, 182, 30); // Caja Inferior

        doc.text(`BENEFICIARIO:`, 16, 60); doc.setFont("helvetica", "bold"); doc.text(`${patient.name}`, 45, 60); doc.setFont("helvetica", "normal");
        doc.text(`DNI:`, 120, 60); doc.text(patient.dni || '---', 145, 60);

        doc.text(`CENTRO SALUD:`, 16, 65); doc.text(patient.health_center || 'NO REGISTRADO', 45, 65);
        doc.text(`DIAGNÓSTICO:`, 120, 65); 
        if (patient.show_diagnosis_pecosa) doc.text(patient.diagnosis || '---', 145, 65); else doc.text('CONFIDENCIAL', 145, 65);

        doc.text(`DIRECCIÓN:`, 16, 70); doc.text(`${patient.address || ''} (${patient.district})`, 45, 70);
        
        doc.text(`ENTREGA:`, 16, 75); 
        const kitName = kitsList?.find((k:any) => k.id === selectedKitId)?.name || 'CANASTA ESTÁNDAR';
        doc.text(kitName, 45, 75);

        // 4. TABLA DE PRODUCTOS
        const body = kitItems?.map((item:any, idx:number) => [
            idx + 1,
            item.name,
            item.unit,
            item.qty.toFixed(2),
            `S/. ${item.cost?.toFixed(4)}`,
            `S/. ${(item.cost * item.qty).toFixed(2)}`
        ]) || [];

        autoTable(doc, {
      styles: { font: 'courier', fontSize: 9, cellPadding: 1, textColor: 0, lineColor: 0, lineWidth: 0.35 },
      headStyles: { fillColor: [255,255,255], textColor: 0, fontStyle: 'bold', lineColor: 0, lineWidth: 0.35 },
 
            startY: 90, 
            head: [['IT', 'PRODUCTO', 'UNIDAD', 'CANTIDAD', 'P. UNIT', 'TOTAL']], 
            body: body,
            theme: 'grid',
        });

        // 5. PIE DE PÁGINA (FIRMAS)
        const finalY = (doc as any).lastAutoTable.finalY + 40;
        
        // Línea Almacén
        doc.line(20, finalY, 80, finalY); 
        doc.text('ALMACÉN / ENTREGA', 35, finalY + 5);
        
        // Línea Paciente
        doc.line(120, finalY, 180, finalY); 
        doc.text('RECIBI CONFORME', 135, finalY + 5);
        doc.setFontSize(7); 
        doc.text('Declaro haber recibido los alimentos conforme para mi tratamiento.', 120, finalY + 10);
    });

    doc.save(`PECOSAS_PANTBC_${new Date().getTime()}.pdf`);
  };

  // --- PROCESO DE ENTREGA ---
  const processMutation = useMutation({
    mutationFn: async () => {
        if (isViewer) throw new Error("Modo lectura: No puede procesar.");
        if (selectedPatients.length === 0) throw new Error("Seleccione pacientes.");
        if (!kitItems || kitItems.length === 0) throw new Error("La canasta está vacía o no se seleccionó Kit.");

        const patientsToProcess = patients?.filter(p => selectedPatients.includes(p.id)) || [];
        const movements: any[] = [];
        let currentPecosa = startPecosa;

        // Validar Stock Global
        for (const item of kitItems) {
            const totalReq = item.qty * patientsToProcess.length;
            if (totalReq > item.stock) {
                throw new Error(`Stock insuficiente de ${item.name}. Req: ${totalReq}, Disp: ${item.stock}`);
            }
        }

        // Crear Movimientos
        for (const p of patientsToProcess) {
            const pecosaStr = `${new Date().getFullYear()}-${String(currentPecosa).padStart(4, '0')}`;
            for (const item of kitItems) {
                movements.push({
                    type: 'OUT',
                    program_id: programId,
                    product_id: item.product_id,
                    quantity: item.qty,
                    center_id: null,
                    observation: `PANTBC: ${p.name} - ${customNote} | FECHA:${dispatchDate}`,
                    pecosa_ref: pecosaStr,
                    created_at: new Date().toISOString()
                });
            }
            currentPecosa++;
        }

        const { error } = await supabase.from('movements').insert(movements);
        if (error) throw error;
        
        // Actualizar Contador
        await supabase.from('app_settings').upsert({key: 'pecosa_counter_PANTBC', value: String(currentPecosa - 1)}, { onConflict: 'key' });

        return patientsToProcess;
    },
    onSuccess: (processed) => {
        generatePecosas(processed);
        alert('Entrega registrada y PECOSAS generadas.');
        setSelectedPatients([]);
        queryClient.invalidateQueries({queryKey:['products']});
      queryClient.invalidateQueries({ queryKey: ['kardex500', programId] });
      queryClient.invalidateQueries({ queryKey: ['movements', programId] });
        queryClient.invalidateQueries({queryKey:['settings_pantbc']});
    },
    onError: (e:any) => alert(e.message)
  });

  const toggleAll = () => { if(selectedPatients.length === filteredPatients?.length) setSelectedPatients([]); else setSelectedPatients(filteredPatients?.map(p => p.id) || []); };
  const handlePreview = () => {
    const patientsToPreview = patients?.filter(p => selectedPatients.includes(p.id)) || [];
    generatePecosas(patientsToPreview);
  };

  return (
    <div className="space-y-6 animate-fade-in">
        {/* RESUMEN CANASTA */}
        <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
             <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                 <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><ShoppingBag size={20} className="text-blue-600"/> Canasta PANTBC (Kit)</h3>
                    <p className="text-xs text-gray-500 mb-2">Seleccione el tipo de canasta a entregar hoy:</p>
                    
                    {/* SELECTOR DE KIT */}
                    <div className="relative inline-block w-64">
                        <select 
                            className="w-full border-2 border-blue-200 rounded p-2 text-sm font-bold text-blue-900 bg-blue-50 appearance-none pr-8 cursor-pointer hover:border-blue-400"
                            value={selectedKitId || ''}
                            onChange={(e) => setSelectedKitId(Number(e.target.value))}
                        >
                            {kitsList?.map((k:any) => <option key={k.id} value={k.id}>{k.name}</option>)}
                            {kitsList?.length === 0 && <option value="">Sin Kits Configurados</option>}
                        </select>
                        <ChevronDown className="absolute right-2 top-3 text-blue-500 pointer-events-none" size={16}/>
                    </div>
                 </div>

                 <div className="text-right">
                    <p className="text-xs font-bold text-gray-500">ITEMS EN CANASTA</p>
                    <p className="text-xl font-bold text-blue-700">{kitItems?.length || 0}</p>
                 </div>
             </div>

             <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t">
                 {kitItems?.map((item:any) => (
                     <span key={item.product_id} className="text-xs bg-white text-gray-700 px-3 py-1 rounded-full border shadow-sm font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {item.name}: {item.qty} {item.unit}
                     </span>
                 ))}
                 {(!kitItems || kitItems.length === 0) && (
                     <span className="text-xs text-red-500 flex items-center gap-1 bg-red-50 px-2 py-1 rounded">
                        <AlertTriangle size={12}/> Seleccione un Kit válido o configúrelo en Ajustes.
                     </span>
                 )}
             </div>
        </div>

        {/* CONTROLES */}
        <div className="bg-gray-100 p-4 rounded border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
             <div className="w-full">
                <label className="text-[10px] font-bold text-gray-500">BUSCAR PACIENTE / C.S.</label>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                    <input className="w-full pl-9 border p-2 rounded" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
             </div>
             
             <div>
                <label className="text-[10px] font-bold text-gray-500">FECHA ENTREGA</label>
                <input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} className="w-full border p-2 rounded" />
             </div>
             
             <div className="lg:col-span-2 flex flex-col gap-2">
                 <div className="flex gap-2">
                    <div className="w-24 shrink-0">
                        <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Hash size={10}/> PECOSA</label>
                        <input type="number" value={startPecosa} onChange={e => setStartPecosa(parseInt(e.target.value))} className="w-full border p-2 rounded text-center font-bold" />
                    </div>
                    <div className="w-full">
                        <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><MessageSquare size={10}/> NOTA PECOSA</label>
                        <input value={customNote} onChange={e => setCustomNote(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Ej: Enero 2026" />
                    </div>
                 </div>
                 
                 <div className="flex justify-end gap-2 mt-1">
                    <button onClick={handlePreview} disabled={selectedPatients.length === 0} className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-black disabled:bg-gray-400 flex items-center gap-2 text-xs transition">
                        <Printer size={16}/> VISTA PREVIA
                    </button>
                    <button onClick={() => processMutation.mutate()} disabled={processMutation.isPending || selectedPatients.length === 0 || isViewer} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 shadow text-xs transition">
                        {processMutation.isPending ? 'PROCESANDO...' : <><Send size={16}/> PROCESAR SALIDA</>}
                    </button>
                 </div>
             </div>
        </div>

        {/* TABLA PACIENTES */}
        <div className="bg-white rounded shadow overflow-hidden">
            <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600">{filteredPatients?.length} Pacientes encontrados</span>
                <span className="text-xs font-bold text-blue-600">{selectedPatients.length} Seleccionados</span>
            </div>
            <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-200 text-xs uppercase sticky top-0">
                        <tr>
                            <th className="p-3 w-10"><input type="checkbox" onChange={toggleAll} checked={selectedPatients.length > 0 && selectedPatients.length === filteredPatients?.length}/></th>
                            <th className="p-3">Paciente</th>
                            <th className="p-3">Establecimiento (C.S.)</th>
                            <th className="p-3">Ubicación</th>
                            <th className="p-3 text-center">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredPatients?.map((p:any) => (
                            <tr key={p.id} className="hover:bg-blue-50">
                                <td className="p-3"><input type="checkbox" checked={selectedPatients.includes(p.id)} onChange={(e) => e.target.checked ? setSelectedPatients([...selectedPatients, p.id]) : setSelectedPatients(selectedPatients.filter(id => id !== p.id))} /></td>
                                <td className="p-3">
                                    <div className="font-bold flex items-center gap-2"><UserCheck size={16} className="text-blue-500"/> {p.name}</div>
                                    <div className="text-xs text-gray-500 ml-6">DNI: {p.dni}</div>
                                </td>
                                <td className="p-3 font-bold text-gray-700">{p.health_center || '---'}</td>
                                <td className="p-3 text-xs text-gray-500">{p.district} {p.place ? `- ${p.place}` : ''}</td>
                                <td className="p-3 text-center"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">ACTIVO</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
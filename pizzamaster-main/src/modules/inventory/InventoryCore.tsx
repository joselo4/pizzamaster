import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../core/api/supabase';
import { audit } from '../../core/services/telemetry';
import { useProgram } from '../../core/context/ProgramContext';
import * as XLSX from 'xlsx';
import { Search, Plus, Package, ArrowDownCircle, ArrowUpCircle, History, FileDown, DollarSign, Tag, RefreshCw, Edit, AlertTriangle } from 'lucide-react';
import { notifySuccess, notifyError } from '../../core/utils/notify';
import { InventoryAlerts } from './components/InventoryAlerts';
import { safeInsert } from '../../core/services/offlineQueue';

type ViewMode = 'STOCK' | 'HISTORY' | 'ALERTS';

export const InventoryCore = () => {
  const { programId, program } = useProgram();
  const queryClient = useQueryClient();
  
  const [view, setView] = useState<ViewMode>('STOCK');
  const [searchTerm, setSearchTerm] = useState('');
  

  // Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false); 
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
 const [batchesList, setBatchesList] = useState<any[]>([]);
  
  // Formularios
  const [productForm, setProductForm] = useState<any>({ name: '', unit: 'KG', min_stock: '' });
  const [moveForm, setMoveForm] = useState<any>({ type: 'IN', quantity: '', price: '', provider: '', doc_ref: '', reason: '', batch_code: '', expiry_date: '' });
  // Compat: si alguna versión antigua del UI refería moveFor/setMoveFor, evitamos crash (ReferenceError).
  const moveFor = moveForm;
  const setMoveFor = setMoveForm;
  const [adjustForm, setAdjustForm] = useState<any>({ newStock: '', reason: '' });

  // Queries
  const { data: products } = useQuery({
    queryKey: ['products', programId],
    queryFn: async () => { const { data } = await supabase.from('products').select('*').eq('program_id', programId).order('name'); return data || []; }
  });

  // Centros (para mostrar destino cuando center_id existe)
  const { data: centers } = useQuery({
    queryKey: ['centers_min', programId],
    queryFn: async () => {
      const { data, error } = await supabase.from('centers').select('id, name').eq('program_id', programId).order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const productMap: Record<string, any> = Object.fromEntries((products || []).map((p: any) => [String(p.id), p]));
  const centerMap: Record<string, any> = Object.fromEntries((centers || []).map((c: any) => [String(c.id), c]));

  // --- KARDEX NUEVO (Últimos 500) ---
  const [kardexSearch, setKardexSearch] = useState('');
  const [kardexType, setKardexType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const { data: kardex, isLoading: kardexLoading, error: kardexError, refetch: refetchKardex } = useQuery({
    queryKey: ['kardex500', programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movements')
        .select('id, created_at, type, quantity, observation, pecosa_ref, product_id, center_id')
        .eq('program_id', programId)
        .order('id', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
  });

  const kardexRows = (kardex || []).filter((m: any) => {
    if (kardexType !== 'ALL' && m.type !== kardexType) return false;
    const q = kardexSearch.trim().toLowerCase();
    if (!q) return true;
    const prod = (productMap[String(m.product_id)]?.name || '').toLowerCase();
    const obs = (m.observation || '').toLowerCase();
    const doc = (m.pecosa_ref || '').toLowerCase();
    const cen = (centerMap[String(m.center_id)]?.name || '').toLowerCase();
    return prod.includes(q) || obs.includes(q) || doc.includes(q) || cen.includes(q);
  });


  // Cálculos usados en el Dashboard superior 
  const totalValorizado = products?.reduce((acc: number, p: any) => acc + (p.stock_current * p.average_cost), 0) || 0;
  const totalItems = products?.length || 0;

  const handleExport = () => {
     const wb = XLSX.utils.book_new();
     
     // Hoja 1: Stock
     const sData = products?.map((p: any) => ({ PRODUCTO: p.name, UNIDAD: p.unit, STOCK: p.stock_current, COSTO: p.average_cost, TOTAL: p.stock_current * p.average_cost }));
     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sData || []), "Stock");
     
     // Hoja 2: Kardex (Últimos 500 movimientos filtrados)
     const hData = kardexRows.map((m: any) => ({
       FECHA: new Date(m.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }),
       PRODUCTO: productMap[String(m.product_id)]?.name || '',
       TIPO: m.type,
       CANTIDAD: m.quantity,
       DESTINO: centerMap[String(m.center_id)]?.name || '',
       DOC: m.pecosa_ref || '',
       OBS: m.observation || ''
     }));
     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hData || []), "Kardex_500");
     XLSX.writeFile(wb, `Inventario_${program}.xlsx`);
  };

  // Mutaciones
  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = { name: productForm.name.toUpperCase(), unit: productForm.unit, program_id: programId };
      if (selectedProduct) await supabase.from('products').update(payload).eq('id', selectedProduct.id);
      else await supabase.from('products').insert({ ...payload, stock_current: 0, average_cost: 0 });
    },
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['products']}); closeModals(); }
  });

  const saveMovement = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error('Seleccione un producto.');
      const qty = parseFloat(moveForm.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida.');
      if (moveForm.type === 'IN') {
        const dr = String((moveForm as any).doc_ref ?? '');
        if (dr.trim().length === 0) throw new Error('Documento de ingreso (doc_ref) es obligatorio.');
        const note = String((moveForm as any).reason ?? (moveForm as any).provider ?? '');
              }
      let batchId = null;
      if (moveForm.type === 'IN') {
        // Crear lote (batches). Intento con campos nuevos; si el esquema no los tiene, reintento sin ellos.
        const baseBatch: any = {
          product_id: selectedProduct.id,
          program_id: programId,
          batch_code: moveForm.batch_code || `L-${new Date().getFullYear()}`,
          expiry_date: moveForm.expiry_date || null,
          quantity_initial: qty,
          quantity_current: qty,
        };
        const extraBatch: any = {
          input_unit_cost: moveForm.price ? parseFloat(moveForm.price) : null,
          provider_name: moveForm.provider ? String(moveForm.provider) : null,
          doc_ref: moveForm.doc_ref ? String(moveForm.doc_ref) : null,
        };
        let res = await supabase.from('batches').insert({ ...baseBatch, ...extraBatch }).select().single();
        if (res.error) {
          const msg = String((res.error as any)?.message || res.error);
          if (msg.toLowerCase().includes('could not find') || msg.toLowerCase().includes('schema cache')) {
            res = await supabase.from('batches').insert(baseBatch).select().single();
          }
        }
        if (res.error) throw res.error;
        batchId = res.data?.id;
      }
      const inDoc = String((moveForm as any).doc_ref ?? '').trim();
      const inProv = String((moveForm as any).provider ?? '').trim();
      const obs = moveForm.type === 'IN' ? `DOC:${inDoc || '—'} PROV:${inProv || '—'}` : String(moveForm.reason || '').toUpperCase();
      const payload = { type: moveForm.type, program_id: programId, product_id: selectedProduct.id, quantity: qty, batch_id: batchId || (moveForm.type==='OUT' ? (batchesList.find(b=>b.batch_code===moveForm.batch_code)?.id||null) : null), input_unit_cost: moveForm.type==='IN'?parseFloat(moveForm.price):null, observation: obs, created_at: new Date().toISOString() };
      { const { error } = await supabase.from('movements').insert(payload); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['products']}); queryClient.invalidateQueries({queryKey:['movements']}); closeModals(); notifySuccess('Movimiento guardado.'); },
    onError: (e: any) => notifyError(e, 'No se pudo guardar el movimiento.')
  });

  const adjustStockMutation = useMutation({
    mutationFn: async () => {
        if (!selectedProduct) throw new Error('Seleccione un producto.');
        if (!adjustForm.reason || adjustForm.reason.length < 5) throw new Error("La nota es obligatoria.");
        { const { error } = await supabase.from('products').update({ stock_current: parseFloat(adjustForm.newStock) }).eq('id', selectedProduct.id); if (error) throw error; }
        { const { error } = await audit('UI_AUDIT', { 
            action: 'AJUSTE_STOCK', 
            details: `Manual: ${selectedProduct.name}. De ${selectedProduct.stock_current} a ${adjustForm.newStock}. Nota: ${adjustForm.reason}`, 
            program_id: programId,
            user_email: 'admin'
        }, null); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['products']}); queryClient.invalidateQueries({queryKey:['audit_logs']}); closeModals(); notifySuccess('Stock ajustado.'); },
    onError: (e:any) => notifyError(e)
  });

  const closeModals = () => { setShowProductModal(false); setShowMovementModal(false); setShowAdjustModal(false); setSelectedProduct(null); setProductForm({ name: '', unit: 'KG' }); setMoveForm({ type: 'IN', quantity: '', price: '', provider: '', doc_ref: '', reason: '', batch_code: '', expiry_date: '' }); setAdjustForm({ newStock: '', reason: '' }); };
  
  const openEdit = (p: any) => { setSelectedProduct(p); setProductForm({ name: p.name, unit: p.unit }); setShowProductModal(true); };
  const openAdjust = (p: any) => { setSelectedProduct(p); setAdjustForm({ newStock: p.stock_current, reason: '' }); setShowAdjustModal(true); };
  
const openMovement = async (p: any, t: 'IN'|'OUT') => {
  setSelectedProduct(p);
  setMoveForm({...moveForm, type: t});
  if (t === 'OUT') {
    try {
      const { data } = await supabase.from('batches').select('*').eq('product_id', p.id).gt('quantity_current', 0).order('expiry_date', { ascending: true });
      setBatchesList(data||[]);
      if ((data||[]).length>0) {
        setMoveForm((m:any)=>({ ...m, batch_code: data![0].batch_code }));
      }
    } catch { setBatchesList([]); }
  } else {
    setBatchesList([]);
  }
  setShowMovementModal(true);
};


  const filteredProducts = products?.filter((p: any) => p.name.includes(searchTerm.toUpperCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* DASHBOARD DE MÉTRICAS (Aquí se usan las variables que daban error) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600"><Package size={24}/></div>
            <div><p className="text-sm text-gray-500 font-bold">Items</p><h3 className="text-2xl font-bold">{totalItems}</h3></div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600"><DollarSign size={24}/></div>
            <div><p className="text-sm text-gray-500 font-bold">Valorizado (S/)</p><h3 className="text-2xl font-bold">{totalValorizado.toFixed(2)}</h3></div>
        </div>
        <div onClick={handleExport} className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4 cursor-pointer hover:bg-gray-50">
            <div className="bg-purple-100 p-3 rounded-full text-purple-600"><FileDown size={24}/></div>
            <div><p className="text-sm text-gray-500 font-bold">Reportes</p><h3 className="text-sm font-bold text-purple-700 underline">Descargar Excel</h3></div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setView('STOCK')} className={`px-4 py-2 rounded-md text-sm font-bold flex gap-2 ${view === 'STOCK' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}><Package size={16} /> Stock</button>
          <button onClick={() => setView('ALERTS')} className={`px-4 py-2 rounded-md text-sm font-bold flex gap-2 ${view === 'ALERTS' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}><AlertTriangle size={16}/> Alertas</button>

      <button onClick={() => setView('HISTORY')} className={`px-4 py-2 rounded-md text-sm font-bold flex gap-2 ${view === 'HISTORY' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}><History size={16} /> Kardex</button>
        </div>
        

        <div className="flex gap-2 w-full md:w-auto">
           <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 text-gray-400" size={16} /><input className="pl-9 pr-4 py-2 border rounded-lg w-full text-sm outline-none uppercase" placeholder="BUSCAR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
           {view === 'STOCK' && <button onClick={() => { setSelectedProduct(null); setProductForm({name:'', unit:'KG'}); setShowProductModal(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={18} /> Nuevo</button>}
        </div>
      </div>

      {view === 'STOCK' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr><th className="p-3">Producto</th><th className="p-3 text-right">Stock</th><th className="p-3 text-center">Movimientos</th><th className="p-3 text-center">Edición</th></tr></thead>
            <tbody>
              {filteredProducts?.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50 border-b">
                  <td className="p-3 font-bold">{p.name} <span className="text-xs font-normal text-gray-500">({p.unit})</span></td>
                  <td className="p-3 text-right font-bold text-lg text-blue-800">{p.stock_current?.toFixed(2)}</td>
                  <td className="p-3 flex justify-center gap-2">
                    <button onClick={() => openMovement(p, 'IN')} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold flex gap-1"><ArrowDownCircle size={14}/> IN</button>
                    <button onClick={() => openMovement(p, 'OUT')} className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold flex gap-1"><ArrowUpCircle size={14}/> OUT</button>
                  </td>
                  <td className="p-3 flex justify-center gap-2">
                     <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-blue-600 p-1" title="Editar Nombre"><Edit size={16}/></button>
                     <button onClick={() => openAdjust(p)} className="text-orange-500 hover:text-orange-700 bg-orange-50 p-1 px-2 rounded flex items-center gap-1 font-bold text-[10px]" title="Ajuste Manual"><RefreshCw size={12}/> AJUSTAR</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
       ) : view === 'ALERTS' ? (
        <InventoryAlerts isViewer={false} />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-bold text-gray-800 flex items-center gap-2">
                <History size={16} /> Kardex (Últimos 500 movimientos)
              </div>
              <div className="text-xs text-gray-500">Total mostrado: <span className="font-bold">{kardexRows.length}</span></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => refetchKardex()} className="px-3 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-2">
                <RefreshCw size={14} /> Actualizar
              </button>
              <button onClick={handleExport} className="px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2">
                <FileDown size={14} /> Exportar Kardex_500
              </button>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500">BUSCAR</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                <input value={kardexSearch} onChange={(e) => setKardexSearch(e.target.value)} className="w-full border rounded pl-10 pr-3 py-2 text-sm" placeholder="Producto, documento, destino, observación..." />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">TIPO</label>
              <select value={kardexType} onChange={(e) => setKardexType(e.target.value as any)} className="w-full border rounded px-3 py-2 text-sm bg-white">
                <option value="ALL">TODOS</option>
                <option value="IN">ENTRADA (IN)</option>
                <option value="OUT">SALIDA (OUT)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3">Fecha (Lima)</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3 text-center">Tipo</th>
                  <th className="p-3 text-right">Cant.</th>
                  <th className="p-3">Destino</th>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Observación</th>
                </tr>
              </thead>
              <tbody>
                {kardexLoading && (<tr><td className="p-4 text-center text-gray-500" colSpan={7}>Cargando...</td></tr>)}
                {kardexError && (<tr><td className="p-4 text-center text-red-600" colSpan={7}>Error: {(kardexError as any)?.message || String(kardexError)}</td></tr>)}
                {!kardexLoading && !kardexError && kardexRows.length === 0 && (<tr><td className="p-4 text-center text-gray-500" colSpan={7}>No hay movimientos para mostrar.</td></tr>)}
                {!kardexLoading && !kardexError && kardexRows.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50 border-b">
                    <td className="p-3 text-xs text-gray-500">{new Date(m.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</td>
                    <td className="p-3 font-medium">{productMap[String(m.product_id)]?.name || '---'}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.type}</span></td>
                    <td className="p-3 text-right font-bold">{Number(m.quantity || 0).toFixed(2)}</td>
                    <td className="p-3 text-xs">{centerMap[String(m.center_id)]?.name || '---'}</td>
                    <td className="p-3 text-xs">{m.pecosa_ref || '---'}</td>
                    <td className="p-3 text-xs text-gray-600">{m.observation || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL MOVIMIENTOS */}
      {showMovementModal && selectedProduct && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg w-full max-w-md border-t-4 border-blue-600">
               <h3 className="font-bold mb-4">{moveForm.type === 'IN' ? 'Entrada' : 'Salida'} - {selectedProduct.name}</h3>
               <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] font-bold text-gray-500">CANTIDAD</label><input type="number" autoFocus className="w-full border p-2 rounded font-bold" value={moveForm.quantity} onChange={e => setMoveForm((m:any)=>({ ...m, quantity: e.target.value }))} /></div>
                    {moveForm.type === 'IN' && <div><label className="text-[10px] font-bold text-gray-500">PRECIO UNIT.</label><input type="number" className="w-full border p-2 rounded" value={moveForm.price} onChange={e => setMoveForm((m:any)=>({ ...m, price: e.target.value }))} /></div>}
                    {moveForm.type === 'IN' && <div><label className="text-[10px] font-bold text-gray-500">DOC. INGRESO (doc_ref)</label><input type="text" className="w-full border p-2 rounded" value={moveForm.doc_ref} onChange={e => setMoveForm((m:any)=>({ ...m, doc_ref: e.target.value }))} placeholder="N° documento" /></div>}
                 </div>
                 {/* Aquí se usa el icono Tag */}
                 
{moveForm.type === 'IN' && (

                    <div className="bg-yellow-50 p-2 rounded border border-yellow-200 grid grid-cols-2 gap-2">
                       <div className="col-span-2 text-[10px] font-bold text-yellow-800 flex items-center gap-1"><Tag size={10}/> LOTE (FEFO)</div>
                       <input className="border p-1 rounded text-xs" placeholder="LOTE" value={moveForm.batch_code} onChange={e => setMoveForm((m:any)=>({ ...m, batch_code: e.target.value }))} />
                       <input type="date" className="border p-1 rounded text-xs" value={moveForm.expiry_date} onChange={e => setMoveForm((m:any)=>({ ...m, expiry_date: e.target.value }))} />
                    </div>
                 )}
                 <input className="w-full border p-2 rounded text-sm" placeholder={moveForm.type === 'IN' ? "PROVEEDOR" : "MOTIVO"} value={moveForm.type === 'IN' ? moveForm.provider : moveForm.reason} onChange={e => moveForm.type === 'IN' ? setMoveForm((m:any)=>({ ...m, provider: e.target.value, reason: e.target.value })) : setMoveForm((m:any)=>({ ...m, reason: e.target.value }))} />
               </div>
               <div className="flex justify-end gap-2 mt-4"><button onClick={closeModals} className="px-4 py-2 text-gray-500 text-xs font-bold">CANCELAR</button><button onClick={() => saveMovement.mutate()} className="bg-blue-600 text-white px-6 py-2 rounded font-bold text-xs">GUARDAR</button></div>
            </div>
         </div>
      )}

      {/* MODAL AJUSTE DIRECTO */}
      {showAdjustModal && selectedProduct && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg w-full max-w-md border-t-4 border-orange-500">
               <h3 className="font-bold mb-2 text-orange-800">Ajuste Manual de Inventario</h3>
               <p className="text-xs text-gray-500 mb-4 bg-orange-50 p-2 rounded">Estás cambiando el stock directamente. Se requiere nota obligatoria.</p>
               <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 mb-1">STOCK ACTUAL: {selectedProduct.stock_current}</label>
                  <label className="block text-xs font-bold text-blue-700 mb-1">NUEVO STOCK</label>
                  <input type="number" autoFocus className="w-full border-2 border-blue-100 p-2 rounded text-lg font-bold text-blue-800" value={adjustForm.newStock} onChange={e => setAdjustForm({...adjustForm, newStock: e.target.value})} />
               </div>
               <div className="mb-4">
                  <label className="block text-xs font-bold text-red-600 mb-1">NOTA OBLIGATORIA</label>
                  <textarea className="w-full border p-2 rounded text-sm min-h-[60px]" placeholder="Motivo..." value={adjustForm.reason} onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})} />
               </div>
               <div className="flex justify-end gap-2"><button onClick={closeModals} className="px-4 py-2 text-gray-500 text-xs font-bold">CANCELAR</button><button onClick={() => adjustStockMutation.mutate()} disabled={!adjustForm.reason} className="bg-orange-600 text-white px-6 py-2 rounded font-bold text-xs disabled:bg-gray-300">CONFIRMAR AJUSTE</button></div>
            </div>
         </div>
      )}

      {/* MODAL PRODUCTO (CREAR/EDITAR) */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm">
            <h3 className="font-bold mb-4">{selectedProduct ? 'Editar' : 'Nuevo'} Producto</h3>
            <input className="w-full border p-2 mb-2 rounded uppercase" placeholder="NOMBRE" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} />
            <select className="w-full border p-2 mb-4 rounded" value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})}><option value="KG">KG</option><option value="LITRO">LITRO</option><option value="UNIDAD">UNIDAD</option><option value="LATA">LATA</option><option value="SACO">SACO</option></select>
            <div className="flex justify-end gap-2"><button onClick={closeModals} className="px-4 py-2 text-gray-500 text-xs font-bold">CANCELAR</button><button onClick={() => saveProduct.mutate()} className="bg-blue-600 text-white px-6 py-2 rounded font-bold text-xs">GUARDAR</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

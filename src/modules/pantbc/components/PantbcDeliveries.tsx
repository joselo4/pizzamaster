
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useAuth } from '../../../core/context/AuthContext';
import { notifySuccess, notifyError } from '../../../core/utils/notify';
import { Plus, Search, Ban, PackageCheck } from 'lucide-react';

const fmt = (v:any) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
};

function monthRange(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

export const PantbcDeliveries = () => {
  const { role, session } = useAuth();
  const isViewer = role === 'viewer';
  const qc = useQueryClient();

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS'|'ENTREGADO'|'ANULADO'>('TODOS');

  const [showNew, setShowNew] = useState(false);
  const [patientId, setPatientId] = useState<string>('');
  const [kitId, setKitId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelRow, setCancelRow] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data: patients } = useQuery({
    queryKey: ['pantbc_patients_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id,name,dni,status')
        .eq('program_id','PANTBC')
        .eq('status','ACTIVO')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
  });

  const { data: kits } = useQuery({
    queryKey: ['kits_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kits').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const { data: deliveries } = useQuery({
    queryKey: ['pantbc_deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pantbc_deliveries')
        .select('*, patients(name,dni), kits(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
  });

  const list = useMemo(() => {
    let rows:any[] = deliveries || [];
    if (statusFilter !== 'TODOS') rows = rows.filter(r => (r.status||'ENTREGADO') === statusFilter);
    if (!q) return rows;
    const uq = q.toUpperCase();
    return rows.filter(r => (`${r.patients?.name||''} ${r.patients?.dni||''} ${r.kits?.name||''}`.toUpperCase().includes(uq)));
  }, [deliveries, q, statusFilter]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (isViewer) throw new Error('Modo solo lectura');
      if (!patientId) throw new Error('Seleccione paciente');
      if (!kitId) throw new Error('Seleccione kit');

      // Validación única mes calendario (solo si status != ANULADO)
      const { start, end } = monthRange(deliveryDate);
      const { data: exists, error: e0 } = await supabase
        .from('pantbc_deliveries')
        .select('id')
        .eq('patient_id', patientId)
        .gte('delivery_date', start)
        .lt('delivery_date', end)
        .neq('status', 'ANULADO')
        .limit(1);
      if (e0) throw e0;
      if (exists && exists.length) {
        throw new Error('Ya existe una entrega para este paciente en el mes seleccionado. Si corresponde, anule la anterior y registre la nueva.');
      }

      // Insert cabecera
      const { data: header, error: e1 } = await supabase
        .from('pantbc_deliveries')
        .insert({ patient_id: patientId, kit_id: Number(kitId), delivery_date: deliveryDate, status: 'ENTREGADO' })
        .select('*')
        .single();

      if (e1) {
        const code = String((e1 as any)?.code || '');
        const msg = String((e1 as any)?.message || '').toLowerCase();
        if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
          throw new Error('Ya existe una entrega para este paciente en el mes seleccionado. Si corresponde, anule la anterior y registre la nueva.');
        }
        throw e1;
      }

      // Items del kit
      const { data: items, error: e2 } = await supabase
        .from('kit_items')
        .select('product_id, quantity, products(name)')
        .eq('kit_id', Number(kitId));
      if (e2) throw e2;

      const rows = (items || []).map((it:any) => ({
        delivery_id: header.id,
        product_id: it.product_id,
        product_name: it.products?.name || null,
        quantity: it.quantity || 0,
      }));

      if (rows.length) {
        const { error: e3 } = await supabase.from('pantbc_delivery_items').insert(rows);
        if (e3) throw e3;
      }

      supabase.from('audit_logs').insert({
        action: 'PANTBC_REGISTRAR_ENTREGA',
        details: JSON.stringify({ delivery_id: header.id, patient_id: patientId, kit_id: Number(kitId), items: rows.length }),
        user_email: session?.user?.email || 'session',
        program_id: 'PANTBC'
      }).then().catch(()=>{});
    },
    onSuccess: () => {
      notifySuccess('Entrega registrada.');
      qc.invalidateQueries({ queryKey: ['pantbc_deliveries'] });
      setShowNew(false);
      setPatientId('');
      setKitId('');
    },
    onError: (e:any) => notifyError(e?.message || e),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (isViewer) throw new Error('Modo solo lectura');
      if (!cancelRow) return;
      if (!cancelReason || cancelReason.trim().length < 10) throw new Error('Motivo mínimo 10 caracteres');
      const { error } = await supabase
        .from('pantbc_deliveries')
        .update({ status: 'ANULADO', justification: cancelReason.trim() })
        .eq('id', cancelRow.id);
      if (error) throw error;
      supabase.from('audit_logs').insert({
        action: 'PANTBC_ANULAR_ENTREGA',
        details: JSON.stringify({ delivery_id: cancelRow.id, justification: cancelReason.trim() }),
        user_email: session?.user?.email || 'session',
        program_id: 'PANTBC'
      }).then().catch(()=>{});
    },
    onSuccess: () => {
      notifySuccess('Entrega anulada.');
      qc.invalidateQueries({ queryKey: ['pantbc_deliveries'] });
      setShowCancel(false); setCancelRow(null); setCancelReason('');
    },
    onError: (e:any) => notifyError(e?.message || e),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-4 rounded border flex flex-wrap items-center gap-2">
        <PackageCheck className="text-blue-600" />
        <div className="font-bold">PANTBC — Entregas</div>
        <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value as any)} className="border p-1 rounded text-sm">
          <option value="TODOS">TODOS</option>
          <option value="ENTREGADO">ENTREGADO</option>
          <option value="ANULADO">ANULADO</option>
        </select>
        <div className="relative">
          <Search className="absolute left-2 top-2 text-gray-400" size={14}/>
          <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Buscar paciente/kit" className="pl-7 pr-3 py-1 border rounded text-sm"/>
        </div>
        <button disabled={isViewer} onClick={()=> setShowNew(true)} className="ml-auto bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={16}/> Nueva</button>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="p-2">Fecha</th><th className="p-2">Paciente</th><th className="p-2">DNI</th><th className="p-2">Kit</th><th className="p-2">Estado</th><th className="p-2">Motivo</th><th className="p-2">Acción</th></tr>
          </thead>
          <tbody>
            {list.map((r:any)=> (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-2 text-xs text-gray-500">{r.delivery_date || ''}</td>
                <td className="p-2 font-bold">{r.patients?.name || '—'}</td>
                <td className="p-2 text-center">{r.patients?.dni || '—'}</td>
                <td className="p-2">{r.kits?.name || String(r.kit_id || '')}</td>
                <td className="p-2">{fmt(r.status || 'ENTREGADO')}</td>
                <td className="p-2 text-xs">{fmt(r.justification)}</td>
                <td className="p-2">
                  <button disabled={isViewer || (r.status==='ANULADO')} onClick={()=>{ setCancelRow(r); setCancelReason(''); setShowCancel(true); }} className="px-2 py-1 border rounded text-xs flex items-center gap-1"><Ban size={14}/> Anular</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td className="p-4 text-gray-400" colSpan={7}>Sin entregas registradas.</td></tr>}
          </tbody>
        </table>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded shadow border-t-4 border-blue-600 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Nueva entrega</h3>
              <button onClick={()=> setShowNew(false)} className="text-xs font-bold text-gray-500">CERRAR</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500">PACIENTE (solo ACTIVO)</label>
                <select value={patientId} onChange={e=> setPatientId(e.target.value)} className="w-full border p-2 rounded text-sm">
                  <option value="">-- Seleccione --</option>
                  {(patients||[]).map((p:any)=> <option key={p.id} value={p.id}>{p.name} {p.dni?`(${p.dni})`:''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500">KIT</label>
                <select value={kitId} onChange={e=> setKitId(e.target.value)} className="w-full border p-2 rounded text-sm">
                  <option value="">-- Seleccione --</option>
                  {(kits||[]).map((k:any)=> <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500">FECHA</label>
                <input type="date" value={deliveryDate} onChange={e=> setDeliveryDate(e.target.value)} className="w-full border p-2 rounded text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={()=> setShowNew(false)} className="px-4 py-2 text-xs font-bold text-gray-600">CANCELAR</button>
                <button onClick={()=> createMut.mutate()} disabled={createMut.isPending || isViewer} className="px-5 py-2 rounded bg-blue-600 text-white text-xs font-bold">{createMut.isPending ? 'PROCESANDO...' : 'GUARDAR'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCancel && cancelRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded shadow border-t-4 border-red-600 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Anular entrega</h3>
              <button onClick={()=> setShowCancel(false)} className="text-xs font-bold text-gray-500">CERRAR</button>
            </div>
            <div className="text-xs text-gray-500 mb-2">Motivo obligatorio (mín. 10 caracteres).</div>
            <textarea value={cancelReason} onChange={e=> setCancelReason(e.target.value)} className="w-full border p-2 rounded text-sm min-h-[90px]" placeholder="Escriba el motivo..." />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={()=> setShowCancel(false)} className="px-4 py-2 text-xs font-bold text-gray-600">CANCELAR</button>
              <button onClick={()=> cancelMut.mutate()} disabled={cancelMut.isPending || isViewer} className="px-5 py-2 rounded bg-red-600 text-white text-xs font-bold">{cancelMut.isPending ? 'PROCESANDO...' : 'CONFIRMAR'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

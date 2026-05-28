
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../core/api/supabase';
import { getProgramLabel, useProgram } from '../../core/context/ProgramContext';
import { notifyError, notifySuccess } from '../../core/utils/notify';

const PROGRAMS = ['PCA_COM', 'PCA_HOG', 'PCA_RSK', 'PCA_ATW', 'PANTBC', 'OLLAS'] as const;

type Mode = 'TRANSFER' | 'PRESTAMO';

const parseRef = (obs?: string | null) => {
  const s = String(obs || '');
  const m = s.match(/(XFER-[A-Z0-9-]+)/i);
  return m ? m[1].toUpperCase() : null;
};

const parseLender = (obs?: string | null) => {
  const s = String(obs || '');
  const m = s.match(/PRESTAMO\s*(?:←|<-|DE|DESDE)\s*([^|]+)\|?/i);
  return m ? String(m[1]).trim() : null;
};

export const TransferPage = () => {
  const qc = useQueryClient();
  const { program: activeProgram } = useProgram();

  const [mode, setMode] = useState<Mode>('TRANSFER');
  const [fromProgram, setFromProgram] = useState<string>(activeProgram);
  const [toProgram, setToProgram] = useState<string>('PANTBC');
  const [productId, setProductId] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const { data: products } = useQuery({
    queryKey: ['transfer_products', fromProgram],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
        .from('products')
        .select('id,name,unit,stock_current')
        .eq('program_id', fromProgram)
        .order('name');
      if (error) throw error;
        return data ?? [];
      } catch (e:any) {
        notifyError(e, 'No se pudo cargar lotes.');
        throw e;
      }
    },
    staleTime: 10_000,
  });

  const { data: batches } = useQuery({
    queryKey: ['transfer_batches', fromProgram, productId],
    enabled: !!productId,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
        .from('batches')
        .select('id,batch_code,expiry_date,quantity_current')
        .eq('program_id', fromProgram)
        .eq('product_id', productId)
        .order('expiry_date', { ascending: true });
      if (error) throw error;
        return data ?? [];
      } catch (e:any) {
        notifyError(e, 'No se pudo cargar lotes.');
        throw e;
      }
    },
    staleTime: 10_000,
  });

  const selectedBatch = useMemo(
    () => (batches ?? []).find((b: any) => String(b.id) === String(batchId)),
    [batches, batchId]
  );

  const { data: recent } = useQuery({
    queryKey: ['transfer_recent'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
        .from('movements')
        .select('id,created_at,program_id,type,quantity,observation')
        .ilike('observation', '%XFER-%')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
        return data ?? [];
      } catch (e:any) {
        notifyError(e, 'No se pudo cargar lotes.');
        throw e;
      }
    },
    staleTime: 10_000,
  });

  const { data: loans } = useQuery({
    queryKey: ['loans_received', activeProgram],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
        .from('movements')
        .select('id, created_at, program_id, type, quantity, observation, product_id, batch_id')
        .eq('program_id', activeProgram)
        .eq('type', 'IN')
        .or("observation.ilike.%PRESTAMO%,observation.ilike.%PRÉSTAMO%,observation.ilike.%PREST%")
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
        return (data ?? []).map((m: any) => ({
        ...m,
        ref: parseRef(m.observation),
        lender: parseLender(m.observation),
      })).filter((m: any) => !!m.ref && !!m.lender && !!m.batch_id);
    },
    staleTime: 10_000,
  });

  const doTransfer = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!fromProgram || !toProgram) throw new Error('Seleccione programa origen y destino.');
      if (fromProgram === toProgram) throw new Error('Origen y destino no pueden ser iguales.');
      if (!productId) throw new Error('Seleccione un producto.');
      if (!batchId) throw new Error('Seleccione un lote.');
      if (!q || q <= 0) throw new Error('Cantidad inválida.');
      if (String(note || '').trim().length < 5) throw new Error('Ingrese una observación (mín. 5).');

      const avail = Number(selectedBatch?.quantity_current ?? 0);
      if (q > avail) throw new Error(`No puede transferir más del stock del lote. Disponible: ${avail}`);

      const { data, error } = await supabase.rpc('transfer_between_programs', {
        p_mode: mode,
        p_from_program: fromProgram,
        p_to_program: toProgram,
        p_product_id: Number(productId),
        p_batch_id: Number(batchId),
        p_quantity: q,
        p_observation: note,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      notifySuccess('Operación registrada.');
      setQty('');
      setNote('');
      qc.invalidateQueries();
    },
    onSuccess: () => {
      notifySuccess('Préstamo devuelto.');
      qc.invalidateQueries();
    },
    onError: (e: any) => notifyError(e),
  });

  const returnLoan = useMutation({
    mutationFn: async (m: any) => {
      const ref = String(m.ref || '').trim();
      const lender = String(m.lender || '').trim();
      if (!ref || !lender) throw new Error('No se pudo determinar ref/origen del préstamo. Verifique que la observación contenga: PRESTAMO ← ORIGEN | ... y una referencia XFER-...');

      const { data: b, error: be } = await supabase
        .from('batches')
        .select('quantity_current')
        .eq('id', m.batch_id)
        .maybeSingle();
      if (be) throw be;
      const available = Math.max(0, Number(b?.quantity_current ?? 0));
      const originalQty = Number(m.quantity ?? 0);
      const q = Math.max(0, Math.min(originalQty, available));
      if (!q || q <= 0) throw new Error('No hay stock disponible para devolver.');

      const { data, error } = await supabase.rpc('transfer_between_programs', {
        p_mode: 'PRESTAMO',
        p_from_program: activeProgram,
        p_to_program: lender,
        p_product_id: Number(m.product_id),
        p_batch_id: Number(m.batch_id),
        p_quantity: q,
        p_observation: 'DEVOLUCION DEL PRESTAMO',
        p_ref: ref,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      notifySuccess('Devolución registrada.');
      qc.invalidateQueries();
    },
    onSuccess: () => {
      notifySuccess('Préstamo devuelto.');
      qc.invalidateQueries();
    },
    onError: (e: any) => notifyError(e),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-6 rounded shadow border-l-4 border-indigo-600">
        <h2 className="text-xl font-black text-gray-800">Transferencias / Préstamos</h2>
        <p className="text-xs text-gray-500">Valida stock y registra OUT/IN en Kardex.</p>
      </div>

      <div className="bg-white p-6 rounded shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500">TIPO</label>
            <select className="w-full border p-2 rounded" value={mode} onChange={e => setMode(e.target.value as any)}>
              <option value="TRANSFER">TRANSFERENCIA</option>
              <option value="PRESTAMO">PRÉSTAMO</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500">ORIGEN</label>
            <select className="w-full border p-2 rounded" value={fromProgram} onChange={e => { setFromProgram(e.target.value); setProductId(''); setBatchId(''); }}>
              {PROGRAMS.map(p => (<option key={p} value={p}>{getProgramLabel(p)}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500">DESTINO</label>
            <select className="w-full border p-2 rounded" value={toProgram} onChange={e => setToProgram(e.target.value)}>
              {PROGRAMS.map(p => (<option key={p} value={p}>{getProgramLabel(p)}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500">PRODUCTO</label>
            <select className="w-full border p-2 rounded" value={productId} onChange={e => { setProductId(e.target.value); setBatchId(''); }}>
              <option value="">— Seleccione —</option>
              {(products ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} — Stock: {p.stock_current ?? 0}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500">LOTE (origen)</label>
            <select className="w-full border p-2 rounded" value={batchId} onChange={e => setBatchId(e.target.value)} disabled={!productId}>
              <option value="">— Seleccione —</option>
              {(batches ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.batch_code} — Venc: {b.expiry_date ?? '—'} — Disp: {Number(b.quantity_current ?? 0).toFixed(3)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500">CANTIDAD</label>
            <input className="w-full border p-2 rounded" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
            {selectedBatch && (
              <p className="text-[10px] text-gray-400 mt-1">Disponible en lote: <b>{Number(selectedBatch.quantity_current ?? 0).toFixed(3)}</b></p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-gray-500">OBSERVACIÓN</label>
            <input className="w-full border p-2 rounded" value={note} onChange={e => setNote(e.target.value)} placeholder="Motivo / detalle (mín. 5)" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={() => doTransfer.mutate()} disabled={doTransfer.isPending} className="bg-indigo-700 text-white px-6 py-2 rounded font-black disabled:bg-gray-300">
            {doTransfer.isPending ? 'Procesando...' : 'Registrar'}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-gray-800">Préstamos recibidos (para devolver)</h3>
          <span className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded">{(loans ?? []).length} últimos</span>
        </div>
        <div className="mt-4 overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Origen</th><th className="p-2 text-left">REF</th><th className="p-2 text-right">Cantidad</th><th className="p-2 text-left">Acción</th></tr>
            </thead>
            <tbody>
              {(loans ?? []).map((m: any) => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="p-2 font-bold">{getProgramLabel(m.lender)}</td>
                  <td className="p-2 font-mono text-[12px]">{m.ref}</td>
                  <td className="p-2 text-right font-bold">{Number(m.quantity ?? 0).toFixed(3)}</td>
                  <td className="p-2">
                    <button onClick={() => returnLoan.mutate(m)} disabled={returnLoan.isPending || !m.lender || !m.ref || !m.batch_id} className="px-3 py-1 rounded bg-emerald-700 text-white font-black text-xs disabled:bg-gray-300">
                      {returnLoan.isPending ? 'Procesando...' : 'Devolver'}
                    </button>
                  </td>
                </tr>
              ))}
              {(loans ?? []).length === 0 && <tr><td colSpan={5} className="p-4 text-gray-400">No hay préstamos recibidos recientes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h3 className="font-black text-gray-800">Últimos movimientos (Kardex)</h3>
        <div className="mt-3 overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="p-2">Fecha</th><th className="p-2">Programa</th><th className="p-2">Tipo</th><th className="p-2 text-right">Cant.</th><th className="p-2">Obs.</th></tr></thead>
            <tbody>
              {(recent ?? []).map((m:any) => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="p-2 font-bold">{getProgramLabel(m.program_id)}</td>
                  <td className="p-2">{m.type}</td>
                  <td className="p-2 text-right">{Number(m.quantity ?? 0).toFixed(3)}</td>
                  <td className="p-2 text-xs">{String(m.observation||'').slice(0,120)}</td>
                </tr>
              ))}
              {(recent ?? []).length === 0 && <tr><td colSpan={5} className="p-4 text-gray-400">Sin registros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransferPage;

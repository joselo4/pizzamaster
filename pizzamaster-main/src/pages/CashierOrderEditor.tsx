
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import toast, { Toaster } from 'react-hot-toast';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = (import.meta.env.VITE_SUPABASE_KEY as string) || (import.meta.env.VITE_SUPABASE_ANON_KEY as string);
const supabase = createClient(supabaseUrl, supabaseKey);

interface OrderRow {
  id: number | string;
  customer_name?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string;
}

const STATUSES = ['Pendiente','Validado','Horno','Listo','En Transporte','Entregado','Recogido','Cancelado'];

export default function CashierOrderEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<OrderRow | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('orders')
          .select('id, customer_name, phone, status, notes, created_at')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (!mounted) return;
        setRow(data as OrderRow);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'No se pudo cargar el pedido');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const canSave = useMemo(() => !!row && !saving, [row, saving]);

  async function save() {
    if (!row) return;
    try {
      setSaving(true);
      const patch: any = {
        customer_name: row.customer_name?.trim?.() || null,
        phone: row.phone?.trim?.() || null,
        status: row.status || null,
        notes: row.notes?.trim?.() || null,
      };
      let usedRpc = false;
      try {
        const { error: rpcError } = await supabase.rpc('admin_update_order', {
          p_id: typeof row.id === 'string' ? row.id : Number(row.id),
          p_patch: patch,
        });
        if (!rpcError) usedRpc = true;
      } catch {}
      if (!usedRpc) {
        const { error: upErr } = await supabase.from('orders').update(patch).eq('id', row.id);
        if (upErr) throw upErr;
      }
      toast.success('Pedido actualizado');
      navigate(-1);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (<div className="p-6"><Toaster /><p className="text-gray-600">Cargando…</p></div>);
  if (!row) return (
    <div className="p-6">
      <Toaster />
      <p className="text-red-600">No se encontró el pedido.</p>
      <button className="mt-4 px-3 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => navigate(-1)}>Volver</button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Editar pedido #{String(row.id)}</h1>
        <button className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => navigate(-1)}>Volver</button>
      </div>
      <div className="space-y-4 bg-white rounded-md border p-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre del cliente</label>
          <input id="customer_name" name="customer_name" value={row.customer_name || ''} onChange={e => setRow(prev => prev ? { ...prev, customer_name: e.target.value } : prev)} className="w-full border rounded px-3 py-2 bg-white text-gray-900" placeholder="Nombre" />
        </div>
        <div>
          <label htmlFor="customer_phone"</label>
          <input id="customer_name" name="customer_name" value={row.phone || ''} onChange={e => setRow(prev => prev ? { ...prev, phone: e.target.value } : prev)} className="w-full border rounded px-3 py-2 bg-white text-gray-900" placeholder="Teléfono" />
        </div>
        <div>
          <label htmlFor="status"</label>
          <select id="status" name="status" value={row.status || ''} onChange={e => setRow(prev => prev ? { ...prev, status: e.target.value } : prev)} className="w-full border rounded px-3 py-2 bg-white text-gray-900">
            <option value="">(sin cambio)</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="notes"</label>
          <textarea id="notes" name="notes" value={row.notes || ''} onChange={e => setRow(prev => prev ? { ...prev, notes: e.target.value } : prev)} className="w-full min-h-[120px] border rounded px-3 py-2 bg-white text-gray-900" placeholder="Observaciones" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!canSave} className={`px-4 py-2 rounded text-white ${saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => navigate(-1)}>Cancelar</button>
      </div>
    </div>
  );
}

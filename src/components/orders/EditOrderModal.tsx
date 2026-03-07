import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { type Order, type CartItem } from '../../types';
import { supabase, logAction } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  onSaved?: (updated: Order) => void;
}

const emptyItem = (): CartItem => ({ id: String(Date.now()), name: '', price: 0, qty: 1 });

export default function EditOrderModal({ open, onClose, order, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && order) {
      const clone: Order = JSON.parse(JSON.stringify(order));
      clone.items = Array.isArray(clone.items) ? clone.items : [];
      setForm(clone);
      setErr('');
    }
  }, [open, order]);

  const subtotal = useMemo(() => {
    if (!form) return 0;
    return (form.items || []).reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  }, [form]);

  const total = useMemo(() => {
    if (!form) return 0;
    return parseFloat((subtotal + (Number(form.delivery_cost) || 0)).toFixed(2));
  }, [subtotal, form]);

  const setField = (k: keyof Order, v: any) => {
    if (!form) return;
    setForm({ ...form, [k]: v } as Order);
  };

  const setItem = (idx: number, patch: Partial<CartItem>) => {
    if (!form) return;
    const next = (form.items || []).map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setForm({ ...form, items: next });
  };

  const addItem = () => {
    if (!form) return;
    setForm({ ...form, items: [...(form.items || []), emptyItem()] });
  };

  const removeItem = (idx: number) => {
    if (!form) return;
    const next = [...(form.items || [])];
    next.splice(idx, 1);
    setForm({ ...form, items: next });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setErr('');
    try {
      const payload: Partial<Order> = {
        client_name: (form.client_name || '').trim(),
        client_phone: (form.client_phone || '').trim(),
        client_address: (form.client_address || '').trim() || undefined,
        notes: form.notes ?? undefined,
        service_type: form.service_type,
        delivery_cost: Number(form.delivery_cost) || 0,
        items: (form.items || []).map((it) => ({
          id: it.id || String(Math.random()),
          name: (it.name || '').trim(),
          price: Number(it.price) || 0,
          qty: Number(it.qty) || 0,
        })),
        total: total,
      } as any;

      const { data, error } = await supabase
        .from('orders')
        .update(payload as any)
        .eq('id', form.id)
        .select('*')
        .single();

      if (error) throw error;

      try {
        await logAction(user?.username || 'system', 'EDITAR_PEDIDO', `Se editó el pedido`, form.id);
      } catch {
        // ignore
      }

      onSaved?.(data as unknown as Order);
      onClose();
    } catch (e: any) {
      setErr(String(e?.message || e || 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  if (!open || !form) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-white w-full max-w-3xl rounded-2xl border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="text-lg font-bold">Editar pedido #{form.id}</div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block">
              <div className="text-xs text-gray-400">Nombre del cliente</div>
              <input value={form.client_name || ''} onChange={e => setField('client_name', e.target.value)} className="w-full rounded-xl bg-gray-900 border border-gray-700 p-2" />
            </label>
            <label className="block">
              <div className="text-xs text-gray-400">Teléfono</div>
              <input value={form.client_phone || ''} onChange={e => setField('client_phone', e.target.value)} className="w-full rounded-xl bg-gray-900 border border-gray-700 p-2" />
            </label>
            <label className="block">
              <div className="text-xs text-gray-400">Dirección</div>
              <input value={form.client_address || ''} onChange={e => setField('client_address', e.target.value)} className="w-full rounded-xl bg-gray-900 border border-gray-700 p-2" />
            </label>
            <label className="block">
              <div className="text-xs text-gray-400">Notas</div>
              <textarea value={form.notes || ''} onChange={e => setField('notes', e.target.value)} className="w-full rounded-xl bg-gray-900 border border-gray-700 p-2 min-h-[80px]" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-gray-400">Servicio</div>
                <select value={form.service_type} onChange={e => setField('service_type', e.target.value as any)} className="w-full rounded-xl bg-gray-900 border border-gray-700 p-2">
                  <option value="Local">Local</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </label>
              <label className="block">
                <div className="text-xs text-gray-400">Costo de envío</div>
                <input type="number" step="0.01" value={form.delivery_cost ?? 0} onChange={e => setField('delivery_cost', Number(e.target.value))} className="w-full rounded-xl bg-gray-900 border border-gray-700 p-2" />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-300">Ítems</div>
              <button type="button" onClick={addItem} className="px-3 py-1.5 rounded-xl border border-gray-700 hover:bg-gray-800 flex items-center gap-1">
                <Plus size={16} /> Agregar
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {(form.items || []).map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input value={it.name} onChange={e => setItem(idx, { name: e.target.value })} placeholder="Producto" className="col-span-6 rounded-xl bg-gray-900 border border-gray-700 p-2" />
                  <input type="number" step="0.01" value={it.price} onChange={e => setItem(idx, { price: Number(e.target.value) })} placeholder="Precio" className="col-span-3 rounded-xl bg-gray-900 border border-gray-700 p-2" />
                  <input type="number" value={it.qty} onChange={e => setItem(idx, { qty: Number(e.target.value) })} placeholder="Cant." className="col-span-2 rounded-xl bg-gray-900 border border-gray-700 p-2" />
                  <button type="button" onClick={() => removeItem(idx)} className="col-span-1 p-2 rounded-xl hover:bg-gray-800 text-red-400" title="Quitar">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="text-right text-sm text-gray-400">Subtotal: S/ {subtotal.toFixed(2)}</div>
            <div className="text-right text-lg font-bold">Total: S/ {total.toFixed(2)}</div>
          </div>
        </div>

        {err && <div className="px-4 pb-2 text-red-400 text-sm">{err}</div>}

        <div className="p-4 border-t border-gray-700 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-700 hover:bg-gray-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400 flex items-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

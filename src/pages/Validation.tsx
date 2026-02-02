
import { useEffect, useMemo, useState } from 'react';
import { supabase, logAction } from '../lib/supabase';
import type { CartItem, OrderRequest, Product, ServiceType } from '../types';
import { approveRequestToOrder, listPendingRequests, setRequestStatus } from '../lib/orderRequests';
import { CheckCircle2, XCircle, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function money(n: number) { return `S/ ${Number(n||0).toFixed(2)}`; }

export default function Validation() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [selected, setSelected] = useState<OrderRequest | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<CartItem[]>([]);
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('Delivery');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(40);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subtotal = useMemo(() => items.reduce((a,i)=>a+i.qty*i.price,0), [items]);
  const total = useMemo(() => subtotal + (serviceType==='Delivery' ? deliveryCost : 0), [subtotal, deliveryCost, serviceType]);

  const load = async () => {
    setError('');
    try {
      const reqs = await listPendingRequests();
      setRequests(reqs);
      const { data } = await supabase.from('products').select('*').eq('active', true);
      setProducts((data || []) as any);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar solicitudes.');
    }
  };

  useEffect(() => {
    load();
    const sub = supabase.channel('order_requests_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const pick = async (r: OrderRequest) => {
    setSelected(r);
    setItems(r.items || []);
    setDeliveryCost(r.delivery_fee || 0);
    setNotes(r.notes || '');
    setClientName(r.customer_name || '');
    setClientPhone(r.phone || '');
    setClientAddress(r.address || '');
    setServiceType(r.service_type);
    setEstimatedMinutes(r.estimated_minutes || 40);
    setRejectReason('');

    if (r.status === 'Nuevo') {
      try { await setRequestStatus(r.id, { status: 'En Revisión' as any }); } catch {}
    }
  };

  const updateItemQty = (id: string, qty: number) => setItems(prev => prev.map(i => i.id===id ? { ...i, qty: Math.max(1, qty) } : i));
  const updateItemPrice = (id: string, price: number) => setItems(prev => prev.map(i => i.id===id ? { ...i, price: Math.max(0, price) } : i));
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const addProduct = (p: Product) => setItems(prev => {
    const f = prev.find(i => i.id===p.id);
    if (f) return prev.map(i => i.id===p.id ? { ...i, qty: i.qty+1 } : i);
    return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
  });

  const saveEdits = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const patch: any = {
        items,
        delivery_fee: serviceType==='Delivery' ? deliveryCost : 0,
        estimated_total: total,
        notes,
        customer_name: clientName,
        phone: clientPhone,
        address: serviceType==='Delivery' ? clientAddress : null,
        service_type: serviceType,
        estimated_minutes: estimatedMinutes,
        status: 'En Revisión',
      };
      const { error: upErr } = await supabase.from('order_requests').update(patch).eq('id', selected.id);
      if (upErr) throw upErr;
      logAction(user?.username || 'operador', 'VALIDATION_SAVE', `Editó solicitud #${selected.id}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar cambios.');
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!selected) return;
    if (items.length === 0) return setError('El pedido no puede quedar vacío.');
    setLoading(true);
    setError('');
    try {
      await saveEdits();
      const order = await approveRequestToOrder({
        request: selected,
        client_name: clientName || 'Cliente',
        client_phone: clientPhone,
        client_address: serviceType==='Delivery' ? clientAddress : undefined,
        items,
        notes,
        total,
        delivery_cost: serviceType==='Delivery' ? deliveryCost : 0,
        service_type: serviceType,
        estimated_minutes: estimatedMinutes,
      });

      logAction(user?.username || 'operador', 'REQUEST_APPROVED', `Aprobó solicitud #${selected.id} -> Orden #${(order as any).id}`, (order as any).id);
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo aprobar.');
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) return setError('Indica un motivo de rechazo.');
    setLoading(true);
    setError('');
    try {
      await setRequestStatus(selected.id, { status: 'Rechazado' as any, reject_reason: rejectReason.trim() as any });
      logAction(user?.username || 'operador', 'REQUEST_REJECTED', `Rechazó solicitud #${selected.id}: ${rejectReason.trim()}`);
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo rechazar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Validación</h1>
          <p className="text-white/60 text-sm">Revisa, edita y envía a cocina.</p>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-2">
          <RefreshCw size={18}/> Refrescar
        </button>
      </div>

      {error && <div className="text-red-400 mb-3">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="font-semibold mb-2">Solicitudes</div>
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-2">
            {requests.map(r => (
              <button key={r.id} onClick={()=>pick(r)} className={`w-full text-left p-3 rounded-lg border ${selected?.id===r.id ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">#{r.id} • {r.service_type === 'Delivery' ? 'Delivery' : 'Recojo'}</div>
                  <div className="text-xs text-white/60">{r.status}</div>
                </div>
                <div className="text-sm text-white/70">{r.customer_name || 'Cliente'} • {r.phone}</div>
                <div className="text-sm text-orange-400 font-bold">{money(r.estimated_total || 0)}</div>
              </button>
            ))}
            {requests.length===0 && <div className="text-white/60 text-sm">No hay solicitudes pendientes.</div>}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-0 overflow-hidden">
          {!selected ? (
            <div className="p-4 text-white/60">Selecciona una solicitud para revisar.</div>
          ) : (
            <div className="flex flex-col h-[75vh] lg:h-[80vh]">
              <div className="flex-1 overflow-y-auto p-4 pb-28">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xl font-bold">Solicitud #{selected.id}</div>
                    <div className="text-white/60 text-sm">Estado: {selected.status}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/60 text-sm">Total</div>
                    <div className="text-2xl font-bold text-orange-400">{money(total)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <label className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="text-xs text-white/60">Cliente</div>
                    <input value={clientName} onChange={e=>setClientName(e.target.value)} className="bg-transparent outline-none w-full" />
                  </label>
                  <label className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="text-xs text-white/60">Teléfono</div>
                    <input value={clientPhone} onChange={e=>setClientPhone(e.target.value)} className="bg-transparent outline-none w-full" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button onClick={()=>setServiceType('Delivery')} className={`p-3 rounded-xl border ${serviceType==='Delivery' ? 'border-orange-500 bg-orange-500/15' : 'border-white/10 bg-white/5'}`}>Delivery</button>
                  <button onClick={()=>setServiceType('Local')} className={`p-3 rounded-xl border ${serviceType==='Local' ? 'border-orange-500 bg-orange-500/15' : 'border-white/10 bg-white/5'}`}>Recojo</button>
                </div>

                {serviceType==='Delivery' && (
                  <label className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3">
                    <div className="text-xs text-white/60">Dirección</div>
                    <input value={clientAddress} onChange={e=>setClientAddress(e.target.value)} className="bg-transparent outline-none w-full" />
                  </label>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <label className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="text-xs text-white/60">Costo Delivery</div>
                    <input type="number" value={deliveryCost} onChange={e=>setDeliveryCost(Number(e.target.value))} className="bg-transparent outline-none w-full" />
                  </label>
                  <label className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="text-xs text-white/60">Tiempo estimado (min)</div>
                    <input type="number" value={estimatedMinutes} onChange={e=>setEstimatedMinutes(Number(e.target.value))} className="bg-transparent outline-none w-full" />
                  </label>
                </div>

                <label className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3">
                  <div className="text-xs text-white/60">Notas</div>
                  <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="bg-transparent outline-none w-full" rows={3} />
                </label>

                <div className="mb-3">
                  <div className="font-semibold mb-2 flex items-center gap-2"><Pencil size={18}/> Ítems (editable)</div>
                  <div className="space-y-2">
                    {items.map(i => (
                      <div key={i.id} className="grid grid-cols-12 gap-2 items-center bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="col-span-5 font-medium">{i.name}</div>
                        <div className="col-span-2">
                          <div className="text-xs text-white/60">Cant.</div>
                          <input type="number" value={i.qty} onChange={e=>updateItemQty(i.id, Number(e.target.value))} className="bg-transparent border border-white/10 rounded-lg px-2 py-1 w-full" />
                        </div>
                        <div className="col-span-3">
                          <div className="text-xs text-white/60">Precio</div>
                          <input type="number" value={i.price} onChange={e=>updateItemPrice(i.id, Number(e.target.value))} className="bg-transparent border border-white/10 rounded-lg px-2 py-1 w-full" />
                        </div>
                        <div className="col-span-2 text-right">
                          <button onClick={()=>removeItem(i.id)} className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30">Quitar</button>
                        </div>
                      </div>
                    ))}
                    {items.length===0 && <div className="text-white/60 text-sm">Sin ítems.</div>}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="font-semibold mb-2 flex items-center gap-2"><Plus size={18}/> Agregar producto</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-auto pr-2">
                    {products.map(p => (
                      <button key={p.id} onClick={()=>addProduct(p)} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-left">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-sm text-white/60">{p.category}</div>
                        <div className="text-orange-400 font-bold">{money(p.price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 p-4 bg-[#121212]/95 backdrop-blur border-t border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button disabled={loading} onClick={saveEdits} className="py-3 rounded-xl bg-white/10 hover:bg-white/20">Guardar cambios</button>
                  <button disabled={loading} onClick={approve} className="py-3 rounded-xl bg-green-500 hover:bg-green-600 flex items-center justify-center gap-2"><CheckCircle2 size={18}/> Aprobar</button>
                  <button disabled={loading} onClick={reject} className="py-3 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center gap-2"><XCircle size={18}/> Rechazar</button>
                </div>

                <div className="mt-2">
                  <input value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Motivo de rechazo" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

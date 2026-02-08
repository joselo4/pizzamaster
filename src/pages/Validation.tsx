
import { useEffect, useMemo, useState } from 'react';
import { supabase, logAction } from '../lib/supabase';
import type { CartItem, OrderRequest, Product, ServiceType } from '../types';
import { approveRequestToOrder, listPendingRequests, setRequestStatus } from '../lib/orderRequests';
import {CheckCircle2, XCircle, Pencil, Plus, RefreshCw, Search, Filter, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function money(n: number) { return `S/ ${Number(n||0).toFixed(2)}`; }

export default function Validation() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [selected, setSelected] = useState<OrderRequest | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [deliveryCost, setDeliveryCost] = useState<number>(3);
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
    setDeliveryCost(r.service_type==='Delivery' ? (r.delivery_fee || 3) : 0);
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
    <main className="mx-auto w-full max-w-7xl px-4 py-4 md:py-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold md:text-2xl">Validación</h1>
        <div className="ml-auto flex flex-1 items-center gap-2 sm:flex-none">
          <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white shadow-sm">
            <Search size={16} className="text-white/50" />
            <input className="w-full bg-transparent outline-none text-sm placeholder:text-white/40" placeholder="Buscar (opcional)" />
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white shadow-sm hover:bg-white/15" onClick={load}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-white/80"><Filter size={14} /> Cola</span>
            <span className="text-xs text-white/60">{requests.length} solicitudes</span>
          </div>

          <ul className="divide-y overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-sm">
            {requests.map((r) => (
              <li key={r.id} className={`flex cursor-pointer items-center justify-between gap-3 p-3 transition hover:bg-white/10 ${selected?.id===r.id ? 'bg-white/10' : ''}`} onClick={() => pick(r)}>
                <div>
                  <p className="text-sm font-medium">Solicitud #{r.id}</p>
                  <p className="text-xs text-white/60">{r.phone} • {money(r.estimated_total || 0)}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/20 px-2 py-1 text-xs text-amber-200"><Clock size={14} /> {r.status}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
            {!selected && <p className="text-sm text-white/70">Selecciona una solicitud para validar</p>}

            {selected && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">Solicitud #{selected.id}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200/20 px-2 py-1 text-xs text-emerald-200"><CheckCircle2 size={14} /> {selected.status}</span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/60">Resumen</p>
                    <p className="text-sm">Items: {items.length}</p>
                    <p className="mt-1 text-sm font-semibold">Total: {money(total)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/60">Cliente</p>
                    <p className="text-sm">{clientName || 'Cliente'}</p>
                    <p className="text-sm">{clientPhone}</p>
                    {serviceType==='Delivery' && <p className="text-sm">{clientAddress}</p>}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">Entrega y costos</div>
                    <div className="text-xs text-white/60">corrige envío / tiempo si aplica</div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-1 text-xs text-white/60">Tipo de servicio</div>
                      <select value={serviceType} onChange={(e) => setServiceType(e.target.value as any)} className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm">
                        <option value="Delivery">Delivery</option>
                        <option value="Local">Local</option>
                      </select>
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-white/60">Costo de envío</div>
                      <input type="number" min={0} step="0.5" value={serviceType==='Delivery' ? deliveryCost : 0} onChange={(e) => setDeliveryCost(Math.max(0, Number(e.target.value) || 0))} disabled={serviceType !== 'Delivery'} className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60" />
                      {serviceType !== 'Delivery' && <div className="mt-1 text-[11px] text-white/50">En Local el envío es 0</div>}
                    </label>
                    <label className="block md:col-span-2">
                      <div className="mb-1 text-xs text-white/60">Tiempo estimado (min)</div>
                      <input type="number" min={5} step="5" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Math.max(5, Number(e.target.value) || 40))} className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm" />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">Agregar producto</div>
                    <div className="text-xs text-white/60">añade algo distinto a lo pedido</div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      <input list="products_list" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Escribe el nombre del producto" className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm placeholder:text-white/40" />
                      <datalist id="products_list">{products.map((p) => (<option key={p.id} value={p.name} />))}</datalist>
                      <div className="mt-1 text-[11px] text-white/50">Tip: elige del autocompletado.</div>
                    </div>
                    <button type="button" onClick={() => { const name = (productSearch || '').trim().toLowerCase(); if (!name) return; const p = products.find(x => (x.name || '').trim().toLowerCase() === name) || products.find(x => (x.name || '').toLowerCase().includes(name)); if (!p) return; addProduct(p); setProductSearch(''); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700">
                      <Plus size={16} /> Añadir
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 p-3">
                  <div className="mb-2 text-sm font-medium">Items</div>
                  <ul className="divide-y divide-white/10">
                    {items.map(i => (
                      <li key={i.id} className="flex flex-col gap-2 py-2 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{i.name}</p><p className="text-xs text-white/60">{money(i.price)}</p></div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="number" min={1} value={i.qty} onChange={(e)=>updateItemQty(i.id, Number(e.target.value)||1)} className="w-20 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm" />
                          <input type="number" min={0} value={i.price} onChange={(e)=>updateItemPrice(i.id, Number(e.target.value)||0)} className="w-24 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm" />
                          <button type="button" onClick={()=>removeItem(i.id)} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">Quitar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={saveEdits} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white shadow-sm hover:bg-white/15 disabled:opacity-60">Guardar cambios</button>
                  <button type="button" onClick={reject} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-sm text-rose-100 shadow-sm hover:bg-rose-500/30 disabled:opacity-60"><XCircle size={16}/> Rechazar</button>
                  <button type="button" onClick={approve} disabled={loading || items.length===0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 size={16}/> Validar</button>
                </div>

                {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-sm text-rose-100">{error}</div>}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

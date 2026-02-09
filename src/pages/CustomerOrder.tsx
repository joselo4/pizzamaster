
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { CartItem, Product, ServiceType } from '../types';
import { canSendRequest, markSent } from '../lib/rateLimit';
import { createOrderRequest, fetchConfigMap } from '../lib/orderRequests';
import { ShoppingCart, UserCog, MapPin, Phone, Clock, Plus, Minus, Trash2, Pizza } from 'lucide-react';

function money(n: number) {
  return `S/ ${Number(n || 0).toFixed(2)}`;
}

function toTrackCode(id: number) {
  // Código corto y fácil: base36 en mayúsculas (ej: 12345 -> 9IX)
  return Math.max(0, Number(id) || 0).toString(36).toUpperCase();
}

function onlyDigits9(v: string) {
  return (v || '').replace(/\D/g, '').slice(0, 9);
}

export default function CustomerOrder() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [serviceType, setServiceType] = useState<ServiceType>('Delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Aviso para clientes (configurable desde Admin > Config)
  const [notice, setNotice] = useState<string>('');
  useEffect(() => {
    (async () => {
      try {
        const cfg: any = await fetchConfigMap();
        const enabled = String(cfg.customer_notice_enabled) === 'true';
        const msg = String(cfg.customer_notice_text || '');
        setNotice(enabled ? msg : '');
      } catch {
        // no romper UI
      }
    })();
  }, []);


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // ✅ Envío por defecto (configurable): S/ 2.00
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(40);
  const [deliveryFee, setDeliveryFee] = useState<number>(2);

  const [trackInput, setTrackInput] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      if (error) {
        console.error(error);
        setProducts([] as any);
      } else {
        const list:any[] = (data || []) as any[];
        list.sort((a, b) => {
          const ia = (a.sort_index ?? 1e9);
          const ib = (b.sort_index ?? 1e9);
          if (ia !== ib) return ia - ib;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
        setProducts(list as any);
      }

      try {
        const c = await fetchConfigMap();
        const est = Number(c.tiempo_estimado_min || c.estimated_minutes || 40);
        setEstimatedMinutes(Number.isFinite(est) ? est : 40);
        const df = Number(c.costo_delivery || c.delivery_fee || 2);
        setDeliveryFee(Number.isFinite(df) ? df : 2);
      } catch {
        // defaults
      }
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => set.add(p.category || 'Otros'));
    return ['Todos', ...Array.from(set).sort((a,b)=>String(a).localeCompare(String(b)))];
  }, [products]);

  const filtered = useMemo(() => {
    const base = (category === 'Todos') ? products : products.filter(p => p.category === category);
    // Mantener el orden personalizado (sort_index) también al filtrar
    return [...base].sort((a: any, b: any) => {
      const ia = (a.sort_index ?? 1e9);
      const ib = (b.sort_index ?? 1e9);
      if (ia !== ib) return ia - ib;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [products, category]);

  const totalItems = useMemo(() => cart.reduce((a, i) => a + i.qty, 0), [cart]);
  const subTotal = useMemo(() => cart.reduce((a, i) => a + i.qty * i.price, 0), [cart]);
  const total = useMemo(
    () => subTotal + (serviceType === 'Delivery' ? deliveryFee : 0),
    [subTotal, deliveryFee, serviceType]
  );

  const qtyOf = (id: string) => cart.find(i => i.id === id)?.qty || 0;

  const addToCart = (p: Product) => {
    setCart(prev => {
      const found = prev.find(i => i.id === p.id);
      if (found) return prev.map(i => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const dec = (id: string) => {
    setCart(prev => prev.map(i => (i.id === id ? { ...i, qty: Math.max(0, i.qty - 1) } : i)).filter(i => i.qty > 0));
  };

  const inc = (id: string) => {
    setCart(prev => prev.map(i => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  };

  const submit = async () => {
    setError('');
    if (cart.length === 0) return setError('Agrega al menos un producto.');

    // ✅ Teléfono: solo 9 dígitos
    const cleanPhone = onlyDigits9(phone);
    if (!cleanPhone || cleanPhone.length !== 9) return setError('Ingresa un teléfono válido de 9 dígitos.');
    if (serviceType === 'Delivery' && address.trim().length < 6) return setError('Ingresa una dirección válida para Delivery.');

    const rl = canSendRequest(cleanPhone, 90_000);
    if (!rl.ok) {
      const s = Math.ceil(rl.remainingMs / 1000);
      return setError(`Espera ${s}s antes de enviar otro pedido.`);
    }

    setLoading(true);
    try {

      // Anti-spam: pedidos recientes por teléfono (últimos 2 min)
      try {
        const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('order_requests')
          .select('*', { count: 'exact', head: true })
          .eq('phone', cleanPhone)
          .gte('created_at', since);
        if ((count || 0) > 0) {
          setLoading(false);
          return setError('Ya registraste un pedido hace poco. Espera un momento.');
        }
      } catch {
        // ok
      }

      const req = await createOrderRequest({
        service_type: serviceType,
        customer_name: name.trim() || undefined,
        phone: cleanPhone,
        address: serviceType === 'Delivery' ? address.trim() : undefined,
        notes: notes.trim() || undefined,
        items: cart,
        estimated_total: total,
        delivery_fee: serviceType === 'Delivery' ? deliveryFee : 0,
        estimated_minutes: estimatedMinutes,
      });

      markSent(cleanPhone);

      // ✅ Track corto basado en id de order_requests (estable en todas las etapas)
      navigate(`/track/${req.public_token}`);

    } catch (e: any) {
      const msg = e?.message || 'Error al enviar el pedido.';
      setError(msg + ' (¿Creaste la tabla order_requests en Supabase?)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="mb-4 rounded-2xl border border-white/10 bg-card p-3 text-sm">
        <span className="font-bold text-orange-300">🔥 Promo del día:</span>
        <Link className="ml-2 text-orange-200 underline" to="/promo?ref=menu">Ver promo</Link>
      </div>

      {notice?.trim() ? (
        <div className="mx-auto max-w-6xl px-4 mt-4">
          <div className="p-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-sm">
            {notice}
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0b0d]/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-rose-500 shadow"><Pizza size={22} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black leading-tight">Haz tu pedido</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-white/60"><Clock size={14} /> Tiempo estimado: {estimatedMinutes} min{serviceType==='Delivery' ? <> <span className="text-white/30">•</span><span>Envío: {money(deliveryFee)}</span></> : null}</div>
            </div>
            <button onClick={() => navigate('/login')} className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15" type="button"><span className="flex items-center gap-2"><UserCog size={18}/> Soy operador</span></button>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-white/70">¿Ya hiciste tu pedido? Ingresa tu token/código para ver el estado</div>
            <div className="mt-2 flex gap-2">
              <input value={trackInput} onChange={(e) => setTrackInput(e.target.value.toUpperCase())} placeholder="Ej: ABC123" className="flex-1 rounded-xl border border-white/10 bg-transparent px-3 py-2 outline-none placeholder:text-white/40" />
              <button type="button" onClick={() => trackInput.trim() && navigate(`/track/${trackInput.trim()}`)} className="rounded-xl bg-white/10 px-4 py-2 font-bold hover:bg-white/15">Ver</button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 pb-28">
        {error && <div className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{error}</div>}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{categories.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${category === c ? 'border-orange-500 bg-orange-500/15 text-orange-200' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>{c}</button>
            ))}</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((p) => { const q = qtyOf(p.id); return (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm transition hover:bg-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 whitespace-normal break-words max-w-full leading-snug"><div className=" text-sm font-black">{p.name}</div><div className="mt-0.5 text-xs text-white/60">{p.category}</div></div>
                  <div className="text-right"><div className="text-sm font-black text-orange-300">{money(p.price)}</div>{q>0 && <div className="mt-1 text-[11px] text-white/60">En carrito: {q}</div>}</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button type="button" onClick={() => addToCart(p)} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-black hover:bg-orange-500"><Plus size={16}/> Agregar</button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => dec(p.id)} disabled={q===0} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"><Minus size={16}/></button>
                    <button type="button" onClick={() => inc(p.id)} disabled={q===0} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"><Plus size={16}/></button>
                  </div>
                </div>
              </div>
            ); })}</div>
          </div>

          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-black">Datos del pedido</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setServiceType('Delivery')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${serviceType==='Delivery' ? 'border-orange-500 bg-orange-500/15 text-orange-200' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>Delivery</button>
                  <button type="button" onClick={() => setServiceType('Local')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${serviceType==='Local' ? 'border-orange-500 bg-orange-500/15 text-orange-200' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>Local</button>
                </div>
                <div className="mt-3 space-y-2">
                  <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nombre (opcional)" className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/40 whitespace-normal break-words max-w-full leading-snug" />
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-3 py-2"><Phone size={16} className="text-white/50" /><input value={phone} onChange={(e)=>setPhone(onlyDigits9(e.target.value))} placeholder="Teléfono (9 dígitos)" className="w-full bg-transparent text-sm outline-none placeholder:text-white/40" /></div>
                  {serviceType==='Delivery' && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-3 py-2"><MapPin size={16} className="text-white/50" /><input value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Dirección" className="w-full bg-transparent text-sm outline-none placeholder:text-white/40" /></div>}
                  <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Notas (opcional)" className="h-20 w-full resize-none rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/40" />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between"><div className="text-sm font-black">Tu carrito</div><div className="text-xs text-white/60">{totalItems} items</div></div>
                {cart.length===0 ? <div className="text-sm text-white/60">Aún no agregas productos.</div> : (
                  <ul className="divide-y divide-white/10">{cart.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-2 whitespace-normal break-words max-w-full leading-snug"><div className="min-w-0"><div className=" text-sm font-semibold">{i.name}</div><div className="text-xs text-white/60">{i.qty} × {money(i.price)}</div></div><div className="text-sm font-black text-orange-300">{money(i.qty*i.price)}</div></li>
                  ))}</ul>
                )}
                <div className="mt-3 space-y-1 text-sm"><div className="flex justify-between text-white/70"><span>Subtotal</span><span className="font-semibold">{money(subTotal)}</span></div>{serviceType==='Delivery' && <div className="flex justify-between text-white/70"><span>Envío</span><span className="font-semibold">{money(deliveryFee)}</span></div>}<div className="flex justify-between border-t border-white/10 pt-2"><span className="font-black">Total</span><span className="font-black text-orange-300">{money(total)}</span></div></div>
                <button type="button" onClick={submit} disabled={loading || cart.length === 0} className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black shadow hover:bg-emerald-700 disabled:opacity-50">{loading ? 'Enviando…' : 'Enviar pedido'}</button>
                <button type="button" onClick={() => setCartOpen(true)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15">Ver / Editar carrito</button>
              </div>
            </div>
          </aside>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0b0b0d]/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-6xl px-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCartOpen(true)} className="h-14 flex items-center justify-between gap-2 rounded-2xl bg-white/5 border border-white/10 px-4"><div className="flex items-center gap-2 min-w-0"><ShoppingCart size={18} /><span className="font-semibold">Carrito</span><span className="text-white/60 text-sm">({totalItems})</span></div><div className="text-right"><div className="text-xs text-white/60">Total</div><div className="text-base font-bold text-orange-300 leading-none">{money(total)}</div></div></button>
            <button type="button" onClick={submit} disabled={loading || cart.length === 0} className="h-14 rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">{loading ? 'Enviando…' : 'Enviar pedido'}</button>
          </div>
        </div>
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setCartOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-[#121214] rounded-t-3xl border-t border-white/10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-6xl p-4">
              <div className="flex items-center justify-between"><div className="font-black text-lg">Tu carrito</div><button type="button" onClick={() => setCartOpen(false)} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">Cerrar</button></div>
              <div className="mt-3 space-y-2">
                {cart.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">No hay productos.</div> : cart.map(i => (
                  <div key={i.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 whitespace-normal break-words max-w-full leading-snug"><div className="min-w-0"><div className=" font-semibold">{i.name}</div><div className="text-xs text-white/60">{money(i.price)}</div></div><div className="flex items-center gap-2"><button type="button" onClick={() => dec(i.id)} className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"><Minus size={16}/></button><div className="w-10 text-center font-black">{i.qty}</div><button type="button" onClick={() => inc(i.id)} className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"><Plus size={16}/></button><button type="button" onClick={() => setCart(prev => prev.filter(x => x.id !== i.id))} className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-200 hover:bg-rose-500/30" title="Quitar"><Trash2 size={16}/></button></div></div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex justify-between text-sm text-white/70"><span>Subtotal</span><span className="font-semibold">{money(subTotal)}</span></div>{serviceType==='Delivery' && <div className="mt-1 flex justify-between text-sm text-white/70"><span>Envío</span><span className="font-semibold">{money(deliveryFee)}</span></div>}<div className="mt-2 flex justify-between border-t border-white/10 pt-2"><span className="font-black">Total</span><span className="font-black text-orange-300">{money(total)}</span></div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
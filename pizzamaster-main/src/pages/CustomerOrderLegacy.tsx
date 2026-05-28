import { useEffect, useMemo, useRef, useState } from 'react';
import {useNavigate, Link, useLocation} from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { CartItem, Product, ServiceType } from '../types';
import { canSendRequest, markSent } from '../lib/rateLimit';
import { createOrderRequest, fetchConfigMap } from '../lib/orderRequests';
import { fetchPedidoConfigMap } from '../lib/pedidoConfig';
import { ShoppingCart, UserCog, MapPin, Phone, Clock, Plus, Minus, Trash2, Pizza } from 'lucide-react';
import { logPedidoVisit } from '../lib/promoCampaigns';
import { toTrackCode } from '../lib/trackingCode';
import { logPromoEvent } from '../lib/promoEvents';

function money(n: number) {
  return `S/ ${Number(n || 0).toFixed(2)}`;
}

function onlyDigits9(v: string) {
  return (v || '').replace(/\D/g, '').slice(0, 9);
}

export default function CustomerOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPedidosPage = location.pathname.startsWith('/pedidos');

  const refParam = useMemo(() => new URLSearchParams(location.search).get('ref'), [location.search]);

  useEffect(() => {
    if (refParam) {
      void logPromoEvent('pedido_visit', { ref: refParam, path: location.pathname + location.search });
    }
  }, [refParam, location.pathname, location.search]);

  useEffect(() => {
    let onFocus: any;
    let onVis: any;
    try {
      const params = new URLSearchParams(location.search);
      const ref = params.get('ref');
      if (!ref) return;
      const key = `promo_visit_logged:${ref}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      logPedidoVisit(ref, null, `${location.pathname}${location.search}`);
    } catch {}
  }, [location.search]);

// ✅ Si vienes desde /promo con ?promo=CODIGO, enfoca la tab Promo y adjunta el código al pedido
useEffect(() => {
  try {
    const params = new URLSearchParams(location.search);
    const p = String(params.get('promo') || '').trim();
    if (p) {
      hasPromoParamRef.current = true;
      setPromoCode(p);
      setCategory('Promo');
    }
  } catch {}
}, [location.search]);

  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<string>('Promo');
  const hasUserChosenCategoryRef = useRef(false);
  const hasPromoParamRef = useRef(false);
  const [pedidoDefaultCategory, setPedidoDefaultCategory] = useState<string>('Promo');
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
    let onFocus: any;
    let onVis: any;
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
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(25);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  const [trackInput, setTrackInput] = useState('');
  const [promoCode, setPromoCode] = useState<string>('');

  // Ventana de atención / botones globales
  const [pedidoEnabled, setPedidoEnabled] = useState<boolean>(true);
  const [pedidoDisabledMessage, setPedidoDisabledMessage] = useState<string>('');
  const [storePhone, setStorePhone] = useState<string>('');
  const [storeWa, setStoreWa] = useState<string>('');

  

  useEffect(() => {
    let onFocus: any;
    let onVis: any;
    let configChannel: any;
    let pollId: any;

    // Cache en memoria para reducir PostgREST egress
    const cache: any = (window as any).__PEDIDO_CACHE__ || ((window as any).__PEDIDO_CACHE__ = { cfgAt: 0, cfg: null, prodAt: 0, prod: null });
    const CFG_TTL = 60_000; // 60s
    const PROD_TTL = 5 * 60_000; // 5 min

    const loadProducts = async () => {
      try {
        const now = Date.now();
        if (cache.prod && (now - cache.prodAt) < PROD_TTL) {
          setProducts(cache.prod);
          return;
        }

        // ✅ incluir is_promo para que el tab Promo funcione
        const { data } = await supabase
          .from('products')
          .select('id,name,price,category,active,sort_index,is_promo')
          .eq('active', true);

        const list: any[] = (data || []) as any[];
        list.sort((a, b) => {
          const ia = (a.sort_index ?? 1e9);
          const ib = (b.sort_index ?? 1e9);
          if (ia !== ib) return ia - ib;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });

        cache.prod = list;
        cache.prodAt = now;
        setProducts(list as any);
      } catch {
        // ignore
      }
    };

    const applyConfig = (c: any) => {
      const estRaw = (c.tiempo_estimado_min ?? c.estimated_minutes ?? null);
      const estNum = estRaw === '' || estRaw === null || estRaw === undefined ? 25 : Number(estRaw);
      setEstimatedMinutes(Number.isFinite(estNum) ? estNum : 25);

      const feeRaw = (c.costo_delivery ?? c.delivery_fee ?? null);
      let feeNum = feeRaw === '' || feeRaw === null || feeRaw === undefined ? 0 : Number(feeRaw);
      if (!Number.isFinite(feeNum)) feeNum = 0;

      const freeFlag = String(c.delivery_gratis ?? c.pedido_delivery_gratis ?? c.free_delivery ?? '').toLowerCase();
      if (freeFlag === 'true' || freeFlag === '1' || freeFlag === 'si' || freeFlag === 'sí') feeNum = 0;

      setDeliveryFee(feeNum);

      const defCat = String(c.pedido_default_category ?? 'Promo');
      setPedidoDefaultCategory(defCat || 'Promo');

      // ✅ Ventana de atención
      setPedidoEnabled(String(c.pedido_enabled ?? 'true') !== 'false');
      setPedidoDisabledMessage(String(c.pedido_disabled_message || ''));

      // ✅ Botones globales
      setStorePhone(String(c.telefono_tienda || c.promo_phone || ''));
      setStoreWa(String(c.promo_wa_number || c.wa_number || ''));

      // ✅ Categoría inicial (solo si usuario no eligió y no hay ?promo=)
      try {
        if (!hasUserChosenCategoryRef.current && !hasPromoParamRef.current) {
          const dc = String(defCat || '').trim();
          if (dc) setCategory(dc);
        }
      } catch {}
    };

    const loadConfig = async () => {
      try {
        const now = Date.now();
        if (cache.cfg && (now - cache.cfgAt) < CFG_TTL) {
          applyConfig(cache.cfg);
          return;
        }

        const c: any = await fetchPedidoConfigMap();
        cache.cfg = c;
        cache.cfgAt = now;
        applyConfig(c);
      } catch {
        // ignore
      }
    };

    const loadAll = async () => {
      await loadProducts();
      await loadConfig();
    };

    void loadAll();

    onFocus = () => { void loadConfig(); };
    window.addEventListener('focus', onFocus);

    onVis = () => { if (document.visibilityState === 'visible') void loadConfig(); };
    document.addEventListener('visibilitychange', onVis);

    // Realtime config (si está habilitado)
    try {
      configChannel = supabase
        .channel('config-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, async () => {
          cache.cfgAt = 0;
          await loadConfig();
        })
        .subscribe();
    } catch {
      // ignore
    }

    // Polling respaldo: 60s
    try {
      pollId = window.setInterval(() => { void loadConfig(); }, 60_000);
    } catch {
      pollId = null;
    }

    return () => {
      try { window.removeEventListener('focus', onFocus); } catch {}
      try { document.removeEventListener('visibilitychange', onVis); } catch {}
      try { if (configChannel) supabase.removeChannel(configChannel); } catch {}
      try { if (pollId) window.clearInterval(pollId); } catch {}
    };
  }, []);

  const categories = useMemo(() => {
  const set = new Set<string>();
  products.forEach(p => set.add(p.category || 'Otros'));

  // Tabs fijos (los existentes) + nuevo tab Promo
  const fixed = ['Promo', 'Pizzas', 'Bebidas', 'Extras', 'Todos'];
  const dynamic = Array.from(set)
    .filter(c => !fixed.includes(c))
    .sort((a, b) => String(a).localeCompare(String(b)));

  return Array.from(new Set([...fixed, ...dynamic]));
}, [products]);

  const filtered = useMemo(() => {
  const base =
    category === 'Todos'
      ? products
      : category === 'Promo'
        ? products.filter((p: any) => Boolean(p?.is_promo))
        : products.filter(p => p.category === category);

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
    if (!pedidoEnabled) return setError(pedidoDisabledMessage || 'Hoy no estamos atendiendo.');
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
        notes: (()=>{ const base=(notes||'').trim(); const p=(promoCode||'').trim(); if(!p) return base||undefined; const tag=`PROMO:${p}`; if(base.toUpperCase().includes(tag.toUpperCase())) return base||undefined; return (base? `${tag} | ${base}` : tag); })(),
        items: cart,
        estimated_total: total,
        delivery_fee: serviceType === 'Delivery' ? deliveryFee : 0,
        estimated_minutes: estimatedMinutes,
      });

      markSent(cleanPhone);

      // ✅ Track corto basado en id de order_requests (estable en todas las etapas)
      navigate(`/track/${req.id}`);

    } catch (e: any) {
      const msg = e?.message || 'Error al enviar el pedido.';
      setError(msg + ' (¿Creaste la tabla order_requests en Supabase?)');
    } finally {
      setLoading(false);
    }
  };
  // FULLSCREEN_CLOSED
  if (!pedidoEnabled) {
    const wa = storeWa ? String(storeWa).replace(/\D/g, '') : '';
    const tel = storePhone ? String(storePhone) : '';
    return (
      <div className="min-h-screen bg-[#0b0b0d] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-rose-500/30 bg-gradient-to-b from-rose-600/25 via-orange-500/10 to-black/10 p-6 shadow-2xl">
          <div className="text-3xl font-black text-rose-200">⛔ Pedidos desactivados</div>
          <div className="mt-3 text-sm text-rose-100/85 whitespace-pre-line">{pedidoDisabledMessage || 'Hoy no atendemos. Vuelve más tarde 🙏'}</div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a className="rounded-2xl border border-white/15 bg-white/5 py-3 text-center font-extrabold hover:bg-white/10" href={tel ? `tel:${tel}` : '#'} onClick={(e) => { if (!tel) e.preventDefault(); }}>Llamar</a>
            <a className="rounded-2xl bg-emerald-600 py-3 text-center font-extrabold hover:bg-emerald-500" href={wa ? `https://wa.me/${wa}` : '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!wa) e.preventDefault(); }}>WhatsApp</a>
          </div>
          <a href="/promo" className="mt-4 block rounded-2xl bg-orange-600 py-3 text-center font-black hover:bg-orange-500">Ver promos</a>
          <div className="mt-4 text-xs text-white/60">Mensaje editable en Admin → Ajustes rápidos → Atención / Pedidos</div>
        </div>
      </div>
    );
  }

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
              <div className="text-lg font-black leading-tight">{isPedidosPage ? 'Pedidos online' : 'Haz tu pedido'}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-white/60"><Clock size={14} /> {isPedidosPage ? 'Compra rápida' : 'Tiempo estimado'}: {estimatedMinutes} min{serviceType==='Delivery' ? <> <span className="text-white/30">•</span><span>Envío: {money(deliveryFee)}</span></> : null}</div>
            </div>
</div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] p-3 shadow-[0_18px_45px_-32px_rgba(0,0,0,0.9)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-white/70">¿Ya hiciste tu pedido? Consulta el estado con tu token/código.</div>
              {isPedidosPage && <div className="w-fit rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-100">Seguimiento en línea</div>}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={trackInput} onChange={(e) => setTrackInput(e.target.value.toUpperCase())} placeholder="Ej: ABC123" className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none placeholder:text-white/40 focus:border-orange-300/45" />
              <button type="button" onClick={() => trackInput.trim() && navigate(`/track/${trackInput.trim()}`)} className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 font-black text-slate-950 shadow-[0_12px_26px_-18px_rgba(251,146,60,0.95)] hover:from-orange-400 hover:to-amber-400">Ver</button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 pb-28">
        {error && <div className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{error}</div>}

        <section className="mb-4 rounded-[32px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.98)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">Pedido premium • fácil de terminar</div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Pide rápido, bonito y sin vueltas</h1>
              <p className="mt-2 text-sm leading-6 text-white/70 sm:text-[15px]">Tus productos favoritos, un checkout simple y confirmación clara para que pedir se sienta fácil y confiable.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75"><span className="block font-semibold text-white">Yape</span><span className="text-white/55">y efectivo</span></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75"><span className="block font-semibold text-white">Delivery</span><span className="text-white/55">activo</span></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75"><span className="block font-semibold text-white">Seguimiento</span><span className="text-white/55">en tiempo real</span></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75"><span className="block font-semibold text-white">Tiempo</span><span className="text-white/55">estimado claro</span></div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{categories.map((c) => (
              <button key={c} type="button" onClick={() => { hasUserChosenCategoryRef.current = true; setCategory(c); }} className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${category === c ? 'border-orange-300/40 bg-gradient-to-r from-orange-500/20 to-amber-500/15 text-orange-100 shadow-[0_10px_26px_-18px_rgba(251,146,60,0.9)]' : 'border-white/10 bg-white/5 text-white/70 hover:border-white/15 hover:bg-white/10 hover:text-white'}`}>{c}</button>
            ))}</div>
            {isPedidosPage && filtered.length > 0 && (
              <div className="mb-4 overflow-hidden rounded-[30px] border border-orange-300/20 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.22),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.11),rgba(255,255,255,0.04))] p-4 shadow-[0_24px_60px_-36px_rgba(251,146,60,0.45)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.20em] text-orange-100/85">Más vendidos para ti</div>
                    <div className="mt-1 text-lg font-black text-white">Compra rápido con ofertas claras y carrito visible</div>
                    <p className="mt-1 text-sm text-white/65">Diseño más comercial: precio protagonista, beneficios de confianza y llamada a la acción más fuerte.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-black text-white">
                    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">🔥 Caliente</div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">⚡ Rápido</div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">✅ Seguro</div>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((p, idx) => { const q = qtyOf(p.id); return (
              <div key={p.id} className="group relative overflow-hidden rounded-[28px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.18),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.04))] p-4 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.95)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300/35 hover:shadow-[0_24px_60px_-30px_rgba(251,146,60,0.42)]">
                {isPedidosPage && idx < 3 && <div className="absolute right-3 top-3 rounded-full border border-orange-300/20 bg-orange-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-100">{idx === 0 ? 'Top venta' : idx === 1 ? 'Favorito' : 'Recomendado'}</div>}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 whitespace-normal break-words max-w-full leading-snug"><div className="text-[15px] font-black tracking-tight text-white">{p.name}</div><div className="mt-1 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/65">{p.category}</div></div>
                  <div className="text-right"><div className="inline-flex rounded-full border border-orange-300/20 bg-orange-500/10 px-2.5 py-1 text-sm font-black text-orange-200">{money(p.price)}</div>{q>0 && <div className="mt-1 text-[11px] font-medium text-emerald-200">En carrito: {q}</div>}</div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-white/55"><span>{isPedidosPage ? 'Preparación al momento' : 'Hecho al momento'}</span><span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">{isPedidosPage ? 'Compra segura' : 'Pedido fácil'}</span></div><div className="mt-3 flex items-center justify-between">
                  <button type="button" onClick={() => addToCart(p)} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_14px_30px_-18px_rgba(251,146,60,0.95)] transition hover:from-orange-400 hover:to-amber-400"><Plus size={16}/> {isPedidosPage ? 'Pedir ahora' : 'Agregar'}</button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => dec(p.id)} disabled={q===0} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 text-white/80 transition hover:border-white/15 hover:bg-white/10 disabled:opacity-40"><Minus size={16}/></button>
                    <button type="button" onClick={() => inc(p.id)} disabled={q===0} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 text-white/80 transition hover:border-white/15 hover:bg-white/10 disabled:opacity-40"><Plus size={16}/></button>
                  </div>
                </div>
              </div>
            ); })}</div>
          </div>

          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] p-4 shadow-[0_20px_55px_-35px_rgba(15,23,42,0.95)] backdrop-blur-sm">
                <div className="flex flex-col"><div className="text-sm font-black text-white">Datos del pedido</div><div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-50"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Aceptamos Yape y efectivo</div></div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={async ()=>{ try{ await fetchConfigMap().then((c:any)=>{ const est=Number(c.tiempo_estimado_min||c.estimated_minutes||40); setEstimatedMinutes(Number.isFinite(est)?est:40); const rawDf = (c.costo_delivery ?? c.delivery_fee ?? 0); const df = Number(rawDf); setDeliveryFee(Number.isFinite(df) ? df : 0); }); }catch{} }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">Refrescar</button>
                  {promoCode && <span className="text-[11px] text-orange-200">Promo: <span className="font-black">{promoCode}</span></span>}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2"><div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 shadow-sm shadow-emerald-950/30">Delivery</div></div>
                <div className="mt-3 space-y-2">
                  <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nombre (opcional)" className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/40 whitespace-normal break-words max-w-full leading-snug" />
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-3 py-2"><Phone size={16} className="text-white/50" /><input value={phone} onChange={(e)=>setPhone(onlyDigits9(e.target.value))} placeholder="Teléfono (9 dígitos)" className="w-full bg-transparent text-sm outline-none placeholder:text-white/40" /></div>
                  {serviceType==='Delivery' && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-3 py-2"><MapPin size={16} className="text-white/50" /><input value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Dirección" className="w-full bg-transparent text-sm outline-none placeholder:text-white/40" /></div>}
                  <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Nota / referencia de domicilio (opcional)" className="h-20 w-full resize-none rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/40" />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-4 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.95)] backdrop-blur-sm">
                <div className="mb-3 flex items-center justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Resumen</div><div className="text-sm font-black text-white">Tu carrito</div><div className="mt-1 text-xs text-white/55">Listo para confirmar en pocos pasos</div></div><div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">{totalItems} items</div></div>
                {cart.length===0 ? <div className="text-sm text-white/60">Aún no agregas productos.</div> : (
                  <ul className="divide-y divide-white/10">{cart.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-2 whitespace-normal break-words max-w-full leading-snug"><div className="min-w-0"><div className=" text-sm font-semibold">{i.name}</div><div className="text-xs text-white/60">{i.qty} × {money(i.price)}</div></div><div className="text-sm font-black text-orange-300">{money(i.qty*i.price)}</div></li>
                  ))}</ul>
                )}
                <div className="mt-3 space-y-1 text-sm"><div className="flex justify-between text-white/70"><span>Subtotal</span><span className="font-semibold">{money(subTotal)}</span></div>{serviceType==='Delivery' && <div className="flex justify-between text-white/70"><span>Envío</span><span className="font-semibold">{money(deliveryFee)}</span></div>}<div className="flex justify-between border-t border-white/10 pt-2"><span className="font-black">Total</span><span className="font-black text-orange-300">{money(total)}</span></div></div>
                <button type="button" onClick={submit} disabled={loading || cart.length === 0} className="mt-3 w-full rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-3.5 text-sm font-black text-slate-950 shadow-[0_18px_35px_-20px_rgba(16,185,129,0.95)] transition hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50">{loading ? 'Enviando…' : 'Confirmar pedido'}</button>
                <button type="button" onClick={() => setCartOpen(true)} className="mt-2 w-full rounded-3xl border border-orange-300/20 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100 transition hover:border-orange-300/35 hover:bg-orange-500/15">Revisar mi pedido</button>
              </div>
            </div>
          </aside>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0b0b0d]/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-6xl px-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCartOpen(true)} className="h-14 flex items-center justify-between gap-3 rounded-3xl border border-orange-300/20 bg-gradient-to-r from-orange-500/14 to-amber-500/10 px-4 shadow-[0_18px_36px_-26px_rgba(251,146,60,0.75)]"><div className="flex min-w-0 items-center gap-2"><span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-orange-200"><ShoppingCart size={18} /></span><span className="min-w-0"><span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Tu pedido</span><span className="font-semibold text-white">Carrito ({totalItems})</span></span></div><div className="text-right"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Total</div><div className="text-base font-black text-orange-200 leading-none">{money(total)}</div></div></button>
            <button type="button" onClick={submit} disabled={loading || cart.length === 0} className="h-14 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 font-black text-slate-950 shadow-[0_18px_36px_-24px_rgba(16,185,129,0.95)] transition hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50">{loading ? 'Enviando…' : 'Confirmar pedido'}</button>
          </div>
        </div>
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setCartOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-[32px] border-t border-white/10 bg-slate-950" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-6xl p-4">
              <div className="flex items-center justify-between"><div className="font-black text-lg">Tu carrito</div><button type="button" onClick={() => setCartOpen(false)} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">Cerrar</button></div>
              <div className="mt-3 space-y-2">
                {cart.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">No hay productos.</div> : cart.map(i => (
                  <div key={i.id} className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-3 whitespace-normal break-words max-w-full leading-snug"><div className="min-w-0"><div className=" font-semibold">{i.name}</div><div className="text-xs text-white/60">{money(i.price)}</div></div><div className="flex items-center gap-2"><button type="button" onClick={() => dec(i.id)} className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"><Minus size={16}/></button><div className="w-10 text-center font-black">{i.qty}</div><button type="button" onClick={() => inc(i.id)} className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"><Plus size={16}/></button><button type="button" onClick={() => setCart(prev => prev.filter(x => x.id !== i.id))} className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-200 hover:bg-rose-500/30" title="Quitar"><Trash2 size={16}/></button></div></div>
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

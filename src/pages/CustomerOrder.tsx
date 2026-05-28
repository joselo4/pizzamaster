import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { CartItem, Product, ServiceType } from '../types';
import { canSendRequest, markSent } from '../lib/rateLimit';
import { createOrderRequest, fetchConfigMap } from '../lib/orderRequests';
import { fetchPedidoConfigMap } from '../lib/pedidoConfig';
import { ShoppingCart, MapPin, Phone, Clock, Plus, Minus, Trash2, Pizza, RefreshCw, Sun, Moon, ShieldCheck, ChevronDown, Sparkles, MessageCircle } from 'lucide-react';
import { logPedidoVisit } from '../lib/promoCampaigns';
import { logPromoEvent } from '../lib/promoEvents';
import SupportChatWidget from '../components/SupportChatWidget';

function money(n: number) {
  return `S/ ${Number(n || 0).toFixed(2)}`;
}

function onlyDigits9(v: string) {
  return (v || '').replace(/\D/g, '').slice(0, 9);
}

function sanitizeXss(val: string): string {
  return (val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function parsePedidoCategories(raw: any, fallback: string[] = ['Promo', 'Pizzas', 'Bebidas', 'Extras']): string[] {
  if (Array.isArray(raw)) {
    const clean = raw.map(String).map(s => s.trim()).filter(Boolean);
    return clean.length ? clean : fallback;
  }
  const s = String(raw ?? '').trim();
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) {
      const clean = v.map(String).map(x => x.trim()).filter(Boolean);
      return clean.length ? clean : fallback;
    }
  } catch {}
  const clean = s.split(',').map(x => x.trim()).filter(Boolean);
  return clean.length ? clean : fallback;
}

function readLocalPedidoCategories(): string[] | null {
  try {
    const raw = localStorage.getItem('pedido_categories_order_v1');
    if (!raw) return null;
    const list = parsePedidoCategories(raw, [])
      .filter(c => c.toLowerCase() !== 'todos')
      .filter((c, idx, arr) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx);
    return list.length ? list : null;
  } catch { return null; }
}

interface ProductCardProps {
  p: Product;
  q: number;
  addedAnimProductId: string | null;
  isPedidosPage: boolean;
  idx: number;
  addToCart: (p: Product) => void;
  dec: (id: string) => void;
  inc: (id: string) => void;
}

const ProductCard = memo(({ p, q, addedAnimProductId, isPedidosPage, idx, addToCart, dec, inc }: ProductCardProps) => {
  const isAddedAnim = addedAnimProductId === p.id;
  
  return (
    <div 
      className={`group relative overflow-hidden rounded-[28px] border p-4 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_22px_55px_-34px_rgba(15,23,42,0.95)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(249,115,22,0.12)] dark:hover:shadow-[0_24px_60px_-30px_rgba(251,146,60,0.42)] ${
        isAddedAnim 
          ? 'animate-flash-green border-emerald-400/80 scale-[1.01]' 
          : 'border-zinc-200 dark:border-white/12 bg-white dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.18),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.04))] hover:border-orange-300/35'
      }`}
    >
      {isAddedAnim && (
        <div className="absolute right-4 top-10 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-250 dark:border-emerald-500/30 px-2 py-0.5 rounded-full z-10 animate-bounce">
          ¡Agregado +1!
        </div>
      )}
      {isPedidosPage && idx < 3 && (
        <div className="absolute right-3 top-3 rounded-full border border-orange-200 dark:border-orange-300/20 bg-orange-100 dark:bg-orange-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-700 dark:text-orange-100">
          {idx === 0 ? 'Top venta' : idx === 1 ? 'Favorito' : 'Recomendado'}
        </div>
      )}
      
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 whitespace-normal break-words max-w-full leading-snug">
          <div className="text-[15px] font-black tracking-tight text-zinc-950 dark:text-white">{p.name}</div>
          <div className="mt-1 inline-flex items-center rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:text-white/65">
            {p.category}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="inline-flex rounded-full border border-orange-200 dark:border-orange-300/20 bg-orange-100/70 dark:bg-orange-500/10 px-2.5 py-1 text-sm font-black text-orange-600 dark:text-orange-200">
            {money(p.price)}
          </div>
          {q > 0 && <div className="mt-1 text-[11px] font-bold text-emerald-650 dark:text-emerald-200">En carrito: {q}</div>}
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 dark:text-white/55">
        <span>{isPedidosPage ? 'Preparación al momento' : 'Hecho al momento'}</span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-250 font-bold">
          {isPedidosPage ? 'Compra segura' : 'Pedido fácil'}
        </span>
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        {q === 0 ? (
          <button 
            type="button" 
            onClick={() => addToCart(p)} 
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-black text-white dark:text-slate-950 shadow-[0_6px_16px_rgba(249,115,22,0.15)] dark:shadow-[0_14px_30px_-18px_rgba(251,146,60,0.95)] transition hover:from-orange-400 hover:to-amber-400"
          >
            <Plus size={16}/> {isPedidosPage ? 'Pedir ahora' : 'Agregar'}
          </button>
        ) : (
          <div className="w-full flex items-center justify-between bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1 border border-zinc-200 dark:border-white/10">
            <button 
              type="button" 
              onClick={() => dec(p.id)} 
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-zinc-700 dark:text-white/80 transition hover:bg-zinc-200 dark:hover:bg-white/10 shadow-sm"
            >
              <Minus size={14}/>
            </button>
            <span className="font-extrabold text-sm text-zinc-800 dark:text-white px-2">
              {q} en mesa
            </span>
            <button 
              type="button" 
              onClick={() => inc(p.id)} 
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-zinc-700 dark:text-white/80 transition hover:bg-zinc-200 dark:hover:bg-white/10 shadow-sm"
            >
              <Plus size={14}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
ProductCard.displayName = 'ProductCard';

export default function CustomerOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPedidosPage = location.pathname.startsWith('/pedidos');

  const refParam = useMemo(() => new URLSearchParams(location.search).get('ref'), [location.search]);

  // --- TEMA CLARO Y OSCURO DINÁMICO ---
  const [theme, setTheme] = useState(() => {
    try {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    if (refParam) {
      void logPromoEvent('pedido_visit', { ref: refParam, path: location.pathname + location.search });
    }
  }, [refParam, location.pathname, location.search]);

  useEffect(() => {
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
  const [pedidoCategories, setPedidoCategories] = useState<string[]>(['Promo', 'Pizzas', 'Bebidas', 'Extras']);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [serviceType] = useState<ServiceType>('Delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // --- NUEVOS ESTADOS Y HOOKS DIDÁCTICOS ---
  const [addedAnimProductId, setAddedAnimProductId] = useState<string | null>(null);
  const [showTracker, setShowTracker] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);

  const currentStep = useMemo(() => {
    if (cart.length === 0) return 1;
    const cleanPhone = phone.replace(/\D/g, '');
    const hasPhone = cleanPhone.length === 9;
    const hasAddress = address.trim().length >= 6;
    if (!hasPhone || !hasAddress) return 2;
    return 3;
  }, [cart, phone, address]);

  const progressPercentage = useMemo(() => {
    if (cart.length === 0) return 20;
    if (currentStep === 2) return 60;
    return 95;
  }, [cart, currentStep]);

  const progressMessage = useMemo(() => {
    if (cart.length === 0) return '👉 Paso 1: Elige tu promo o pizza favorita del menú de abajo.';
    if (currentStep === 2) return '👉 Paso 2: Completa tu nombre, celular de 9 dígitos y dirección en el formulario.';
    return '👉 Paso 3: ¡Listo! Presiona "Confirmar pedido" para mandarlo por Yape/Efectivo.';
  }, [cart, currentStep]);

  const crossSellProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const clean = products.filter(p => 
      (p.category === 'Bebidas' || p.category === 'Extras') && 
      !cart.some(item => item.id === p.id)
    );
    return clean.slice(0, 2);
  }, [products, cart]);

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
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(25);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  const [trackInput, setTrackInput] = useState('');
  const [promoCode, setPromoCode] = useState<string>('');

  // Ventana de atención / botones globales
  const [pedidoEnabled, setPedidoEnabled] = useState<boolean>(true);
  const [pedidoDisabledMessage, setPedidoDisabledMessage] = useState<string>('');
  const [storePhone, setStorePhone] = useState<string>('');
  const [storeWa, setStoreWa] = useState<string>('');

  // Refresco manual de configuración (no invasivo)
  const manualRefreshConfig = async () => {
    try { localStorage.removeItem('pizza_config_cache_v1'); } catch {}
    try {
      const cache = (window as any).__PEDIDO_CACHE__;
      if (cache) { cache.cfgAt = 0; cache.cfg = null; }
    } catch {}
    try {
      const c: any = await fetchPedidoConfigMap();
      const applyCfg = (window as any).__APPLY_CFG__;
      if (typeof applyCfg === 'function') await applyCfg(c);
      else window.dispatchEvent(new Event('focus'));
    } catch {
      try { window.dispatchEvent(new Event('focus')); } catch {}
    }
  };

  useEffect(() => {
    let configChannel: any;
    let pollId: any;

    // Cache en memoria para reducir PostgREST egress
    const cache: any = (window as any).__PEDIDO_CACHE__ || ((window as any).__PEDIDO_CACHE__ = { cfgAt: 0, cfg: null, prodAt: 0, prod: null });
    const CFG_TTL = 0; // siempre refresca config de tags
    const PROD_TTL = 30_000; // cache corto de productos

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

    const fetchPedidoCategoriesDirect = async (): Promise<string[] | null> => {
      try {
        const { data, error } = await supabase
          .from('config')
          .select('key,text_value,numeric_value')
          .eq('key', 'pedido_categories')
          .maybeSingle();
        if (error) {
          console.warn('[pedido_categories] error leyendo config', error.message || error);
          return null;
        }
        const raw = (data as any)?.text_value ?? (data as any)?.numeric_value;
        const list = parsePedidoCategories(raw, [])
          .filter(c => c.toLowerCase() !== 'todos')
          .filter((c, idx, arr) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx);
        return list.length ? list : null;
      } catch (e) {
        console.warn('[pedido_categories] error inesperado', e);
        return null;
      }
    };

    const applyConfig = async (c: any) => {
      const estRaw = (c.tiempo_estimado_min ?? c.estimated_minutes ?? null);
      const estNum = estRaw === '' || estRaw === null || estRaw === undefined ? 25 : Number(estRaw);
      setEstimatedMinutes(Number.isFinite(estNum) ? estNum : 25);

      const feeRaw = (c.costo_delivery ?? c.delivery_fee ?? null);
      let feeNum = feeRaw === '' || feeRaw === null || feeRaw === undefined ? 0 : Number(feeRaw);
      if (!Number.isFinite(feeNum)) feeNum = 0;

      const freeFlag = String(c.delivery_gratis ?? c.pedido_delivery_gratis ?? c.free_delivery ?? '').toLowerCase();
      if (freeFlag === 'true' || freeFlag === '1' || freeFlag === 'si' || freeFlag === 'sí') feeNum = 0;

      setDeliveryFee(feeNum);

      const defCat = String(
        c.pedido_default_category ??
        c.pedido_default_tab ??
        c.pedido_categoria_inicial ??
        'Promo'
      );
      setPedidoDefaultCategory(defCat || 'Promo');
      {
        const directCats = await fetchPedidoCategoriesDirect();
        const helperCats = parsePedidoCategories(c.pedido_categories ?? c.pedido_tabs ?? c.pedido_tags ?? '', []);
        const localCats = readLocalPedidoCategories();
        const finalCats = directCats || (helperCats.length ? helperCats : null) || localCats || ['Promo', 'Pizzas', 'Bebidas', 'Extras'];
        setPedidoCategories(finalCats);
      }

      // ✅ Ventana de atención
      setPedidoEnabled(String(c.pedido_enabled ?? 'true') !== 'false');
      setPedidoDisabledMessage(String(c.pedido_disabled_message || ''));

      // ✅ Botones globales
      setStorePhone(String(
        c.store_phone ??
        c.pedido_contact_phone ??
        c.pedido_phone ??
        c.telefono_tienda ??
        c.promo_phone ??
        ''
      ));
      setStoreWa(String(
        c.store_wa ??
        c.pedido_contact_wa ??
        c.pedido_wa ??
        c.promo_wa_number ??
        c.wa_number ??
        ''
      ));

      // ✅ Categoría inicial (solo si usuario no eligió y no hay ?promo=)
      try {
        if (!hasUserChosenCategoryRef.current && !hasPromoParamRef.current) {
          const dc = String(defCat || '').trim();
          if (dc) setCategory(dc);
        }
      } catch {}
    };

    // Exponer applyConfig para refresco manual (runtime; no rompe)
    try { (window as any).__APPLY_CFG__ = applyConfig; } catch {}

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
        await applyConfig(c);
      } catch {
        // ignore
      }
    };

    const loadAll = async () => {
      await loadProducts();
      await loadConfig();
    };

    void loadAll();

    let onFocus: (() => void) | undefined;
    let onVis: (() => void) | undefined;

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
      try { if (onFocus) window.removeEventListener('focus', onFocus); } catch {}
      try { if (onVis) document.removeEventListener('visibilitychange', onVis); } catch {}
      try { if (configChannel) supabase.removeChannel(configChannel); } catch {}
      try { if (pollId) window.clearInterval(pollId); } catch {}
    };
  }, []);

  const categories = useMemo(() => {
    const fixed = ['Promo', 'Pizzas', 'Bebidas', 'Extras'];
    const configured = (pedidoCategories?.length ? pedidoCategories : fixed)
      .map(c => String(c || '').trim())
      .filter(Boolean)
      .filter(c => c.toLowerCase() !== 'todos')
      .filter((c, idx, arr) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx);

    const fromProducts = products
      .map(p => String(p.category || '').trim())
      .filter(Boolean)
      .filter(c => c.toLowerCase() !== 'todos')
      .filter(c => !configured.some(x => x.toLowerCase() === c.toLowerCase()))
      .filter((c, idx, arr) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx);

    // Orden: 1) Admin/Supabase pedido_categories, 2) categorías nuevas de productos, 3) Todos.
    return [...configured, ...fromProducts, 'Todos'];
  }, [pedidoCategories, products]);

  useEffect(() => {
    const visible = categories.filter(c => c.toLowerCase() !== 'todos');
    if (visible.length && !categories.some(c => c.toLowerCase() === category.toLowerCase())) {
      setCategory(visible[0]);
    }
  }, [categories, category]);

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

  const qtyOf = useCallback((id: string) => cart.find(i => i.id === id)?.qty || 0, [cart]);

  // Callback estables para evitar re-renders innecesarios en la cuadrícula de productos
  const addToCart = useCallback((p: Product) => {
    setCart(prev => {
      const found = prev.find(i => i.id === p.id);
      if (found) return prev.map(i => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
    setAddedAnimProductId(p.id);
    setTimeout(() => setAddedAnimProductId(null), 800);
  }, []);

  const dec = useCallback((id: string) => {
    setCart(prev => prev.map(i => (i.id === id ? { ...i, qty: Math.max(0, i.qty - 1) } : i)).filter(i => i.qty > 0));
  }, []);

  const inc = useCallback((id: string) => {
    setCart(prev => prev.map(i => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  }, []);

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

      // XSS Hardening Sanitization
      const sanitizedName = sanitizeXss(name.trim());
      const sanitizedAddress = serviceType === 'Delivery' ? sanitizeXss(address.trim()) : undefined;
      const sanitizedNotes = (() => {
        const base = sanitizeXss((notes || '').trim());
        const p = sanitizeXss((promoCode || '').trim());
        if (!p) return base || undefined;
        const tag = `PROMO:${p}`;
        if (base.toUpperCase().includes(tag.toUpperCase())) return base || undefined;
        return base ? `${tag} | ${base}` : tag;
      })();

      const req = await createOrderRequest({
        service_type: serviceType,
        customer_name: sanitizedName || undefined,
        phone: cleanPhone,
        address: sanitizedAddress,
        notes: sanitizedNotes,
        items: cart,
        estimated_total: total,
        delivery_fee: serviceType === 'Delivery' ? deliveryFee : 0,
        estimated_minutes: estimatedMinutes,
      });

      markSent(cleanPhone);

      // ✅ Track corto basado en id de order_requests
      navigate(`/track/${req.id}`);

    } catch (e: any) {
      const msg = e?.message || 'Error al enviar el pedido.';
      setError(msg + ' (¿Creaste la tabla order_requests en Supabase?)');
    } finally {
      setLoading(false);
    }
  };

  if (!pedidoEnabled) {
    const wa = storeWa ? String(storeWa).replace(/\D/g, '') : '';
    const tel = storePhone ? String(storePhone) : '';
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b0b0d] text-zinc-900 dark:text-white flex items-center justify-center px-4 transition-colors duration-300">
        <div className="w-full max-w-lg rounded-3xl border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-gradient-to-b dark:from-rose-600/25 dark:via-orange-500/10 dark:to-black/10 p-6 shadow-xl dark:shadow-2xl">
          <div className="text-3xl font-black text-rose-650 dark:text-rose-200">⛔ Pedidos desactivados</div>
          <div className="mt-3 text-sm text-zinc-600 dark:text-rose-100/85 whitespace-pre-line">{pedidoDisabledMessage || 'Hoy no atendemos. Vuelve más tarde 🙏'}</div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a className="rounded-2xl border border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-white/5 py-3 text-center font-extrabold hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-white" href={tel ? `tel:${tel}` : '#'} onClick={(e) => { if (!tel) e.preventDefault(); }}>Llamar</a>
            <a className="rounded-2xl bg-emerald-600 py-3 text-center font-extrabold text-white hover:bg-emerald-500" href={wa ? `https://wa.me/${wa}` : '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!wa) e.preventDefault(); }}>WhatsApp</a>
          </div>
          <a href="/promo" className="mt-4 block rounded-2xl bg-orange-600 py-3 text-center font-black text-white hover:bg-orange-500">Ver promos</a>
          <div className="mt-4 text-xs text-zinc-400 dark:text-white/60">Mensaje editable en Admin → Ajustes rápidos → Atención / Pedidos</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900 dark:bg-dark dark:text-white transition-colors duration-300">
      {notice?.trim() ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="p-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 text-sm font-semibold">
            {notice}
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-[#0b0b0d]/85 text-zinc-900 dark:text-white backdrop-blur transition-colors duration-300">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-rose-500 shadow text-white"><Pizza size={22} /></div>
              <div className="min-w-0">
                <div className="text-lg font-black leading-tight">{isPedidosPage ? 'Pedidos online' : 'Haz tu pedido'}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-white/60"><Clock size={14} /> {isPedidosPage ? 'Compra rápida' : 'Tiempo estimado'}: {estimatedMinutes} min{serviceType==='Delivery' ? <> <span className="text-zinc-300 dark:text-white/30">•</span><span>Envío: {money(deliveryFee)}</span></> : null}</div>
              </div>
            </div>

            {/* SUN / MOON TOGGLE */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-zinc-200 dark:border-white/15 bg-zinc-100 hover:bg-zinc-205 dark:bg-white/5 dark:hover:bg-white/10 transition text-zinc-800 dark:text-white flex items-center justify-center shrink-0 shadow-sm"
              title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>

          {/* RASTREADOR DE PASOS DIDÁCTICO */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-200 dark:border-white/5 pt-3">
            {[
              { step: 1, label: '1. Elige Pizza 🍕' },
              { step: 2, label: '2. Tus Datos 📋' },
              { step: 3, label: '3. Yape y Listo ⚡' }
            ].map(s => {
              const active = currentStep === s.step;
              const completed = currentStep > s.step;
              return (
                <div 
                  key={s.step} 
                  className={`text-center py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all duration-300 border ${
                    active 
                      ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/10 border-orange-500/50 text-orange-700 dark:text-orange-200 shadow-md scale-[1.02]' 
                      : completed 
                        ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-300' 
                        : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/5 text-zinc-400 dark:text-white/40'
                  }`}
                >
                  <span className="truncate block">{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* TRACKING COLAPSABLE */}
          <div className="mt-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-card p-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_18px_45px_-32px_rgba(0,0,0,0.9)]">
            <button 
              type="button" 
              onClick={() => setShowTracker(prev => !prev)}
              className="w-full flex items-center justify-between text-xs font-black text-orange-600 dark:text-orange-300 hover:opacity-90 transition-opacity"
            >
              <span>🔍 ¿Ya pediste? Rastrear mi pedido</span>
              <span className="text-zinc-400 dark:text-white/40 text-[10px]">{showTracker ? 'Ocultar ▲' : 'Ver ▼'}</span>
            </button>
            
            {showTracker && (
              <div className="mt-3 border-t border-zinc-150 dark:border-white/5 pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-semibold text-zinc-550 dark:text-white/70">Consulta el estado de tu orden ingresando tu código:</div>
                  {isPedidosPage && <div className="w-fit rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-600 dark:text-emerald-100">Seguimiento en línea</div>}
                </div>
                <div className="mt-2 flex gap-2">
                  <input 
                    value={trackInput} 
                    onChange={(e) => setTrackInput(e.target.value.toUpperCase())} 
                    placeholder="Ej: ABC123" 
                    className="flex-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-3 py-2 text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/40 focus:border-orange-500/50" 
                  />
                  <button 
                    type="button" 
                    onClick={() => trackInput.trim() && navigate(`/track/${trackInput.trim()}`)} 
                    className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 font-black text-white dark:text-slate-950 shadow-[0_12px_26px_-18px_rgba(251,146,60,0.95)] hover:from-orange-400 hover:to-amber-400"
                  >
                    Buscar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 pb-28">
        {error && <div className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-800 dark:text-rose-100 font-semibold">{error}</div>}

        {/* DYNAMIC PROGRESS BAR & STATUS INSTRUCTION */}
        <div className="mb-4 rounded-2xl border border-zinc-200 dark:border-white/5 bg-white dark:bg-white/[0.03] p-4 shadow-sm dark:shadow-md backdrop-blur flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-orange-600 dark:text-orange-355 uppercase tracking-widest leading-snug">{progressMessage}</span>
            <span className="text-zinc-500 dark:text-white/60">{progressPercentage}% Completo</span>
          </div>
          <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-450 rounded-full transition-all duration-500" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* BANNER COMERCIAL MINIMALISTA */}
        <div className="mb-4 rounded-2xl border border-orange-200 dark:border-orange-500/25 bg-gradient-to-r from-orange-500/10 to-amber-500/5 dark:from-orange-500/15 dark:to-transparent px-4 py-3.5 shadow-xs flex items-center justify-between gap-3 text-sm transition-colors">
          <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 font-black">
            <Sparkles size={16} className="text-orange-500 shrink-0" />
            <span>Pide rápido, paga fácil al repartidor y disfruta caliente 🍕</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 dark:text-white/60">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Garantía de sabor</span>
          </div>
        </div>

        <Link to="/promo?ref=pedido_top" className="mb-3 flex items-center justify-between gap-3 rounded-[24px] border border-orange-200 dark:border-orange-300/25 bg-white dark:bg-[linear-gradient(135deg,rgba(251,146,60,0.18),rgba(24,24,27,0.92))] px-4 py-3 shadow-[0_8px_24px_rgba(251,146,60,0.05)] dark:shadow-[0_18px_45px_-34px_rgba(251,146,60,0.85)] transition hover:border-orange-300/55 hover:bg-orange-500/5">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-orange-500 to-red-500 text-white shadow-[0_12px_28px_-20px_rgba(251,146,60,0.9)]"><Pizza size={19} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-zinc-900 dark:text-white sm:text-base">🔥 Ver promociones</span>
              <span className="block truncate text-xs font-semibold text-zinc-500 dark:text-orange-100/70 sm:text-sm">Ofertas disponibles antes de confirmar.</span>
            </span>
          </span>
          <span className="shrink-0 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white px-4 py-2 text-xs font-black text-zinc-800 dark:text-zinc-950 shadow-sm">Entrar</span>
        </Link>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {categories.map((c) => {
                const count = c === 'Todos' ? products.length : c === 'Promo' ? products.filter((p: any) => Boolean(p?.is_promo)).length : products.filter(p => p.category === c).length;
                const emojiMap: Record<string, string> = {
                  Promo: '🔥 Promo',
                  Pizzas: '🍕 Pizzas',
                  Bebidas: '🥤 Bebidas',
                  Extras: '🍟 Extras',
                  Todos: '✨ Todos'
                };
                const displayLabel = emojiMap[c] || `🍕 ${c}`;
                return (
                  <button 
                    key={c} 
                    type="button" 
                    onClick={() => { hasUserChosenCategoryRef.current = true; setCategory(c); }} 
                    className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-black transition-all duration-200 ${
                      category === c 
                        ? 'scale-[1.02] border-orange-300/50 bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 shadow-[0_16px_34px_-18px_rgba(251,146,60,0.95)] animate-sparkle' 
                        : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 text-zinc-600 dark:text-white/75 hover:border-orange-200/30 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{displayLabel}</span><span className="ml-2 rounded-full bg-zinc-100 dark:bg-black/20 px-2 py-0.5 text-[11px] text-zinc-500 dark:text-white/60">{count}</span>
                  </button>
                );
              })}
            </div>
            
            {filtered.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-zinc-300 dark:border-white/15 bg-white dark:bg-white/[0.04] p-8 text-center">
                <div className="text-2xl font-black text-zinc-800 dark:text-white">Pronto agregaremos productos aquí</div>
                <p className="mt-2 text-sm text-zinc-500 dark:text-white/60">Esta categoría se puede llenar desde Admin → Productos, sin tocar código.</p>
              </div>
            )}

            {/* CUADRÍCULA DE PRODUCTOS MEMOIZADA */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p, idx) => (
                <ProductCard 
                  key={p.id}
                  p={p}
                  q={qtyOf(p.id)}
                  addedAnimProductId={addedAnimProductId}
                  isPedidosPage={isPedidosPage}
                  idx={idx}
                  addToCart={addToCart}
                  dec={dec}
                  inc={inc}
                />
              ))}
            </div>
          </div>

          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-4">
              {/* COMPONENT: DATOS DEL PEDIDO SIMPLIFICADO */}
              <div className="rounded-[28px] border border-zinc-200 dark:border-white/12 bg-white dark:bg-zinc-900/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_20px_55px_-35px_rgba(15,23,42,0.95)] backdrop-blur-sm transition-colors duration-300">
                <div className="flex flex-col">
                  <div className="text-sm font-black text-zinc-800 dark:text-white">Datos del pedido</div>
                  <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-amber-450/30 bg-gradient-to-r from-amber-500/10 to-emerald-500/5 dark:from-amber-500/15 dark:to-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-50">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-450 animate-pulse" />
                    Aceptamos Yape y efectivo
                  </div>
                </div>
                
                <div className="mt-2 flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={manualRefreshConfig} 
                    className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-2 py-1 text-xs text-zinc-550 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/10"
                  >
                    Refrescar
                  </button>
                  {promoCode && <span className="text-[11px] text-orange-600 dark:text-orange-200">Promo activa: <span className="font-black">{promoCode}</span></span>}
                </div>
                
                <div className="mt-3">
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-400/30 bg-emerald-50 dark:bg-gradient-to-r dark:from-emerald-500/15 dark:to-cyan-500/10 px-3 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-100 shadow-sm text-center">
                    🛵 Entrega a Domicilio (Delivery)
                  </div>
                </div>
                
                {/* FORMULARIO SIMPLIFICADO Y AGRUPADO EN UNA SOLA LÍNEA MÓVIL */}
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <input 
                      value={name} 
                      onChange={(e)=>setName(e.target.value)} 
                      placeholder="Tu Nombre (opcional)" 
                      className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/25 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/40 focus:border-orange-500/50" 
                    />
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/25 px-3 py-2 focus-within:border-orange-500/50 transition-colors">
                      <Phone size={14} className="text-zinc-400 dark:text-white/40 shrink-0" />
                      <input 
                        value={phone} 
                        onChange={(e)=>setPhone(onlyDigits9(e.target.value))} 
                        placeholder="Celular (9 dígitos)" 
                        className="w-full bg-transparent text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/40" 
                      />
                    </div>
                  </div>
                  
                  {serviceType==='Delivery' && (
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/25 px-3 py-2 focus-within:border-orange-500/50 transition-colors">
                      <MapPin size={14} className="text-zinc-400 dark:text-white/40 shrink-0" />
                      <input 
                        value={address} 
                        onChange={(e)=>setAddress(e.target.value)} 
                        placeholder="Dirección exacta de entrega" 
                        className="w-full bg-transparent text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/40" 
                      />
                    </div>
                  )}

                  {/* AREA DE NOTAS COLAPSABLE */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNotesField(prev => !prev)}
                      className="text-xs font-semibold text-orange-650 dark:text-orange-355 hover:underline flex items-center gap-1 focus:outline-none"
                    >
                      {showNotesField ? '✏️ Quitar nota o referencia' : '✏️ ¿Añadir nota o referencia? (ej. casa color verde)'}
                    </button>
                    
                    {showNotesField && (
                      <textarea 
                        value={notes} 
                        onChange={(e)=>setNotes(e.target.value)} 
                        placeholder="Timbre, color de fachada, indicaciones de entrega..." 
                        className="mt-2 h-16 w-full resize-none rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/25 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/40 focus:border-orange-500/50 transition-all" 
                      />
                    )}
                  </div>
                </div>

                {/* CAJA DE CONFIANZA YAPE/EFECTIVO */}
                <div className="mt-3 p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-500/25 flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-600/25 border border-purple-200 dark:border-purple-500/35 flex items-center justify-center font-black text-purple-700 dark:text-purple-300 text-[11px] shrink-0">
                    Yape
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-black text-purple-800 dark:text-purple-200">Pago Contra Entrega</div>
                    <div className="text-[10px] text-zinc-500 dark:text-slate-350 mt-0.5">Yapea o paga en efectivo directamente al repartidor cuando llegue tu pizza caliente.</div>
                  </div>
                </div>
              </div>

              {/* COMPONENT: RESUMEN DE TU CARRITO */}
              <div className="rounded-[28px] border border-zinc-200 dark:border-white/12 bg-white dark:bg-zinc-900/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_18px_50px_-34px_rgba(15,23,42,0.95)] backdrop-blur-sm transition-colors duration-300">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-white/45">Resumen</div>
                    <div className="text-sm font-black text-zinc-800 dark:text-white">Tu carrito</div>
                    <div className="mt-1 text-xs text-zinc-555 dark:text-white/55">Listo para confirmar en pocos pasos</div>
                  </div>
                  <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-2.5 py-1 text-xs text-zinc-600 dark:text-white/70 font-semibold">{totalItems} items</div>
                </div>
                
                {cart.length === 0 ? (
                  <div className="text-sm text-zinc-500 dark:text-white/60 text-center py-4">Aún no agregas productos.</div>
                ) : (
                  <ul className="divide-y divide-zinc-150 dark:divide-white/10 max-h-40 overflow-y-auto no-scrollbar">
                    {cart.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 py-2 whitespace-normal break-words max-w-full leading-snug">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-800 dark:text-white">{i.name}</div>
                          <div className="text-xs text-zinc-500 dark:text-white/60">{i.qty} × {money(i.price)}</div>
                        </div>
                        <div className="text-sm font-black text-orange-650 dark:text-orange-300 shrink-0">{money(i.qty * i.price)}</div>
                      </li>
                    ))}
                  </ul>
                )}
                
                <div className="mt-3 space-y-1 text-sm border-t border-zinc-150 dark:border-white/10 pt-3">
                  <div className="flex justify-between text-zinc-650 dark:text-white/70">
                    <span>Subtotal</span>
                    <span className="font-semibold">{money(subTotal)}</span>
                  </div>
                  {serviceType==='Delivery' && (
                    <div className="flex justify-between text-zinc-650 dark:text-white/70">
                      <span>Envío</span>
                      <span className="font-semibold">{money(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-zinc-200 dark:border-white/10 pt-2 text-zinc-900 dark:text-white">
                    <span className="font-black text-base">Total</span>
                    <span className="font-black text-base text-orange-655 dark:text-orange-300">{money(total)}</span>
                  </div>
                </div>

                {/* VENTA CRUZADA: COMPLETA TU ANTOJO */}
                {crossSellProducts.length > 0 && (
                  <div className="mt-4 p-3 rounded-2xl border border-zinc-150 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.02]">
                    <div className="text-xs font-black text-orange-650 dark:text-orange-300 flex items-center gap-1.5">
                      🥤 ¿Un extra o gaseosa heladita?
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {crossSellProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addToCart(p)}
                          className="text-left p-2 rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/5 hover:border-orange-500/35 hover:shadow-xs transition flex flex-col justify-between"
                        >
                          <div className="text-[11px] font-bold text-zinc-800 dark:text-white truncate w-full">{p.name}</div>
                          <div className="mt-1 flex items-center justify-between w-full">
                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{money(p.price)}</span>
                            <span className="text-[10px] text-orange-600 dark:text-orange-200 font-black">+ Sí</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  type="button" 
                  onClick={submit} 
                  disabled={loading || cart.length === 0} 
                  className="mt-4 w-full rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-3.5 text-sm font-black text-white dark:text-slate-950 shadow-[0_6px_20px_rgba(16,185,129,0.15)] dark:shadow-[0_18px_35px_-20px_rgba(16,185,129,0.95)] transition hover:from-emerald-400 hover:to-teal-350 disabled:opacity-50"
                >
                  {loading ? 'Enviando…' : 'Confirmar pedido 🍕'}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setCartOpen(true)} 
                  className="mt-2 w-full rounded-3xl border border-zinc-200 dark:border-orange-300/20 bg-zinc-50 dark:bg-orange-500/10 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-orange-100 transition hover:bg-zinc-100 dark:hover:bg-orange-500/15"
                >
                  Revisar mi pedido
                </button>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {/* BOTTOM FIXED BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-[#0b0b0d]/95 text-zinc-955 dark:text-white backdrop-blur transition-colors duration-300 shadow-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-6xl px-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button 
              type="button" 
              onClick={() => setCartOpen(true)} 
              className="h-14 flex items-center justify-between gap-3 rounded-3xl border border-orange-200 dark:border-orange-300/20 bg-orange-50 dark:bg-orange-500/10 px-4 shadow-[0_6px_16px_rgba(249,115,22,0.05)] dark:shadow-[0_18px_36px_-26px_rgba(251,146,60,0.75)]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-100 dark:bg-white/10 text-orange-655 dark:text-orange-200">
                  <ShoppingCart size={18} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-white/45">Tu pedido</span>
                  <span className="font-bold text-zinc-800 dark:text-white text-xs sm:text-sm">Carrito ({totalItems})</span>
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-white/45">Total</div>
                <div className="text-sm sm:text-base font-black text-orange-655 dark:text-orange-200 leading-none">{money(total)}</div>
              </div>
            </button>
            <button 
              type="button" 
              onClick={submit} 
              disabled={loading || cart.length === 0} 
              className="h-14 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 font-black text-white dark:text-slate-950 shadow-[0_6px_18px_rgba(16,185,129,0.15)] dark:shadow-[0_18px_36px_-24px_rgba(16,185,129,0.95)] transition hover:from-emerald-400 hover:to-teal-350 disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      </div>

      {/* SHOPPING CART DIALOG (MODAL) */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center" onClick={() => setCartOpen(false)}>
          <div className="w-full max-w-lg rounded-t-[32px] border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-slate-950 text-zinc-900 dark:text-white shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={(e) => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-black text-lg">Tu carrito</div>
                <button type="button" onClick={() => setCartOpen(false)} className="rounded-xl bg-zinc-100 dark:bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-700 dark:text-white">Cerrar</button>
              </div>
              <div className="mt-3 space-y-2 max-h-[45vh] overflow-y-auto no-scrollbar">
                {cart.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-4 text-sm text-zinc-500 dark:text-white/60 text-center">No hay productos en tu carrito.</div>
                ) : (
                  cart.map(i => (
                    <div key={i.id} className="flex items-center justify-between gap-3 rounded-3xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-3 whitespace-normal break-words max-w-full leading-snug">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{i.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-white/60">{money(i.price)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => dec(i.id)} className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center text-zinc-700 dark:text-white"><Minus size={14}/></button>
                        <div className="w-8 text-center font-black text-sm">{i.qty}</div>
                        <button type="button" onClick={() => inc(i.id)} className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center text-zinc-700 dark:text-white"><Plus size={14}/></button>
                        <button type="button" onClick={() => setCart(prev => prev.filter(x => x.id !== i.id))} className="h-9 w-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-200 flex items-center justify-center" title="Quitar"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-4">
                <div className="flex justify-between text-sm text-zinc-550 dark:text-white/70">
                  <span>Subtotal</span>
                  <span className="font-semibold">{money(subTotal)}</span>
                </div>
                {serviceType === 'Delivery' && (
                  <div className="mt-1 flex justify-between text-sm text-zinc-555 dark:text-white/70">
                    <span>Envío</span>
                    <span className="font-semibold">{money(deliveryFee)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-zinc-250 dark:border-white/10 pt-2 font-black">
                  <span>Total</span>
                  <span className="text-orange-655 dark:text-orange-300">{money(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {import.meta.env?.DEV && (
        <div className="fixed left-3 top-3 z-40 rounded bg-black/60 px-2 py-1 text-xs text-white">
          Def: {pedidoDefaultCategory}
        </div>
      )}

      <button
        type="button"
        onClick={manualRefreshConfig}
        title="Refrescar config"
        className="fixed bottom-24 right-3 z-40 inline-flex items-center justify-center rounded-full bg-zinc-900/85 p-3 text-white shadow-lg hover:bg-zinc-800 focus:outline-none"
      >
        <RefreshCw size={18} />
      </button>

      <SupportChatWidget />
    </div>
  );
}

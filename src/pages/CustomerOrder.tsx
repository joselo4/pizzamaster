
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { CartItem, Product, ServiceType } from '../types';
import { canSendRequest, markSent } from '../lib/rateLimit';
import { openWhatsApp, STORE_WA_NUMBER } from '../lib/whatsapp';
import { createOrderRequest, fetchConfigMap } from '../lib/orderRequests';
import { ShoppingCart, UserCog, MapPin, Phone, Clock } from 'lucide-react';

function money(n: number) {
  return `S/ ${Number(n || 0).toFixed(2)}`;
}

export default function CustomerOrder() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serviceType, setServiceType] = useState<ServiceType>('Delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(40);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('products').select('*').eq('active', true).order('category', { ascending: true });
      setProducts((data || []) as any);
      try {
        const c = await fetchConfigMap();
        const est = Number(c.tiempo_estimado_min || c.estimated_minutes || 40);
        setEstimatedMinutes(Number.isFinite(est) ? est : 40);
        const df = Number(c.costo_delivery || c.delivery_fee || 0);
        setDeliveryFee(Number.isFinite(df) ? df : 0);
      } catch {
        // defaults
      }
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => set.add(p.category || 'Otros'));
    return ['Todos', ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    if (category === 'Todos') return products;
    return products.filter(p => p.category === category);
  }, [products, category]);

  const totalItems = useMemo(() => cart.reduce((a, i) => a + i.qty, 0), [cart]);
  const subTotal = useMemo(() => cart.reduce((a, i) => a + i.qty * i.price, 0), [cart]);
  const total = useMemo(() => subTotal + (serviceType === 'Delivery' ? deliveryFee : 0), [subTotal, deliveryFee, serviceType]);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const found = prev.find(i => i.id === p.id);
      if (found) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const dec = (id: string) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty - 1) } : i).filter(i => i.qty > 0));
  };

  const inc = (id: string) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i));
  };

  const submit = async () => {
    setError('');
    if (cart.length === 0) return setError('Agrega al menos un producto.');
    const cleanPhone = phone.replace(/\D/g,'');
    if (cleanPhone.length < 9) return setError('Ingresa un teléfono válido.');
    if (serviceType === 'Delivery' && address.trim().length < 6) return setError('Ingresa una dirección válida para Delivery.');

    const rl = canSendRequest(cleanPhone, 90_000);
    if (!rl.ok) {
      const s = Math.ceil(rl.remainingMs / 1000);
      return setError(`Espera ${s}s antes de enviar otro pedido.`);
    }

    setLoading(true);
    try {
      const publicToken = crypto.randomUUID();

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
        public_token: publicToken,
      });

      markSent(cleanPhone);

      const trackUrl = `${window.location.origin}/track/${req.public_token}`;
      const msgLines = [
        '🍕 *Nuevo Pedido Web*',
        `Tipo: ${serviceType === 'Delivery' ? 'Delivery' : 'Recojo'}`,
        name.trim() ? `Cliente: ${name.trim()}` : 'Cliente: (sin nombre)',
        `Tel: ${cleanPhone}`,
        serviceType === 'Delivery' ? `Dirección: ${address.trim()}` : 'Dirección: (Recojo)',
        '',
        '*Detalle:*',
        ...cart.map(i => `• ${i.qty} x ${i.name} (${money(i.price)})`),
        '',
        `Subtotal: ${money(subTotal)}`,
        serviceType === 'Delivery' ? `Delivery: ${money(deliveryFee)}` : null,
        `Total: ${money(total)}`,
        notes.trim() ? `Notas: ${notes.trim()}` : null,
        '',
        `Seguimiento: ${trackUrl}`,
      ].filter(Boolean);

      // NO partir el string
      openWhatsApp(msgLines.join('\n'), STORE_WA_NUMBER);
      navigate(`/track/${req.public_token}`);

    } catch (e: any) {
      const msg = e?.message || 'Error al enviar el pedido.';
      setError(msg + ' (¿Creaste la tabla order_requests en Supabase?)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <header className="sticky top-0 z-10 bg-[#121212]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-3xl mx-auto p-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">Pedido Fácil</div>
            <div className="text-xs text-white/60 flex items-center gap-2"><Clock size={14}/> Tiempo estimado: {estimatedMinutes} min</div>
          </div>
          <button onClick={() => navigate('/login')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-2" title="Ingreso de Operador">
            <UserCog size={18}/> Soy operador
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 pb-32">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => setServiceType('Delivery')} className={`p-3 rounded-xl border ${serviceType==='Delivery' ? 'border-orange-500 bg-orange-500/15' : 'border-white/10 bg-white/5'}`}>Delivery</button>
          <button onClick={() => setServiceType('Local')} className={`p-3 rounded-xl border ${serviceType==='Local' ? 'border-orange-500 bg-orange-500/15' : 'border-white/10 bg-white/5'}`}>Recojo</button>
        </div>

        <div className="grid gap-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2">
              <Phone size={18} className="text-white/60"/>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Tu teléfono (obligatorio)" className="bg-transparent outline-none w-full" />
            </label>
            <label className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2">
              <span className="text-white/60">👤</span>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre (opcional)" className="bg-transparent outline-none w-full" />
            </label>
          </div>

          {serviceType === 'Delivery' && (
            <label className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2">
              <MapPin size={18} className="text-white/60"/>
              <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección de entrega" className="bg-transparent outline-none w-full" />
            </label>
          )}

          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas (referencias, sin cebolla, etc.)" className="bg-white/5 border border-white/10 rounded-xl p-3 outline-none" rows={3} />
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-3 py-2 rounded-full text-sm border ${category===c ? 'border-orange-500 bg-orange-500/15' : 'border-white/10 bg-white/5'}`}>{c}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} className="text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-white/70">{p.category}</div>
              <div className="mt-2 text-orange-400 font-bold">{money(p.price)}</div>
            </button>
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#121212]/95 backdrop-blur">
        <div className="max-w-3xl mx-auto p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><ShoppingCart size={18}/> <span className="font-semibold">Carrito</span> <span className="text-white/60 text-sm">({totalItems} items)</span></div>
            <div className="text-right">
              <div className="text-sm text-white/60">Total</div>
              <div className="text-xl font-bold text-orange-400">{money(total)}</div>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="max-h-40 overflow-auto pr-2 mb-3">
              {cart.map(i => (
                <div key={i.id} className="flex items-center justify-between py-2 border-b border-white/10">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-white/60">{money(i.price)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => dec(i.id)} className="w-9 h-9 rounded-lg bg-white/10">-</button>
                    <div className="w-8 text-center">{i.qty}</div>
                    <button onClick={() => inc(i.id)} className="w-9 h-9 rounded-lg bg-white/10">+</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={submit} disabled={loading} className={`w-full py-3 rounded-xl font-bold ${loading ? 'bg-white/10' : 'bg-orange-500 hover:bg-orange-600'}`}>
            {loading ? 'Enviando...' : 'Enviar pedido'}
          </button>

          <div className="text-xs text-white/50 mt-2">Al enviar, se abrirá WhatsApp para confirmar. Tu pedido pasa primero por validación.</div>
        </div>
      </div>
    </div>
  );
}

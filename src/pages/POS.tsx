// SE ELIMINÓ 'React' DEL IMPORT PARA CORREGIR EL WARNING
import { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { type CartItem, type Product } from '../types';
import { generateTicketPDF } from '../lib/ticket';
import { Send, Plus, Minus, ShoppingCart, User, Phone, MapPin, FileText, Loader2, Armchair, Printer, CheckCircle, X, Share2, Trash2 } from 'lucide-react';
import { openSmsComposer } from '../lib/smsDevice';
import { buildStatusSmsMessage } from '../lib/smsTemplates';
import { getConfigCache } from '../lib/configCache';

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cat, setCat] = useState('Todos');
  
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [notes, setNotes] = useState('');
  
  // INICIA EN DELIVERY POR DEFECTO
  const [service, setService] = useState('Delivery');
  const [tableNum, setTableNum] = useState('');
  
  const [costKey, setCostKey] = useState('costo_cerca');
  const [costs, setCosts] = useState<any>({});
  const [ticketConfig, setTicketConfig] = useState<any>({});
  
  const [payOnDelivery, setPayOnDelivery] = useState(false);
  const [loading, setLoading] = useState(false);

  const [lastOrder, setLastOrder] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    supabase.from('products').select('*').eq('active', true).order('name').then(({ data }) => { const list:any[] = (data || []) as any[]; list.sort((a,b)=>{ const ia=(a.sort_index ?? 1e9); const ib=(b.sort_index ?? 1e9); if (ia!==ib) return ia-ib; return String(a.name||'').localeCompare(String(b.name||'')); }); setProducts(list as any); });
    supabase.from('config').select('*').then(({ data }) => {
      const c: any = {};
      data?.forEach((row:any) => c[row.key] = row.numeric_value || row.text_value);
      setCosts(c);
      setTicketConfig(c);
    });
  }, []);

  useEffect(() => {
    if (phone.length === 9) {
      supabase.from('customers').select('*').eq('phone', phone).single().then(({ data }) => {
        if (data) { setName(data.name); setAddr(data.address || ''); }
      });
    }
  }, [phone]);

  const updateCart = (p: Product | CartItem, delta: number) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === p.id);
      if (!exists && delta > 0) return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
      if (exists) {
        const newQty = exists.qty + delta;
        return newQty <= 0 ? prev.filter(i => i.id !== p.id) : prev.map(i => i.id === p.id ? { ...i, qty: newQty } : i);
      }
      return prev;
    });
  };

  const getDeliveryCost = () => {
    if (service !== 'Delivery') return 0;
    if (costKey === 'gratis') return 0;
    return costs[costKey] || 0;
  };

  const sendOrder = async () => {
    if (loading) return;
    if (!name) return alert("⚠️ Falta nombre del cliente");
    if (service === 'Delivery' && (!addr || phone.length !== 9)) return alert("⚠️ Faltan datos de delivery");
    if (service === 'Local' && !tableNum) return alert("⚠️ Falta número de mesa");
    if (cart.length === 0) return alert("⚠️ Carrito vacío");
    
    setLoading(true);

    try {
        const deliveryCost = getDeliveryCost();
        const totalItems = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
        const total = totalItems + deliveryCost;

        const { data, error } = await supabase.from('orders').insert({
          client_name: name, client_phone: phone, client_address: addr, items: cart, total, delivery_cost: deliveryCost, notes,
          status: 'Pendiente', 
          service_type: service, 
          table_number: service === 'Local' ? tableNum : null,
          payment_method: 'Por definir', 
          payment_status: 'Pendiente', 
          pay_on_delivery: payOnDelivery 
        }).select().single();

        if (!error && data) {
            if(phone) await supabase.from('customers').upsert({ phone, name, address: addr });
            logAction(user!.username, 'TOMA_PEDIDO', `${service} - S/${total}`, data.id);
            setLastOrder(data);
            setShowSuccessModal(true);
            maybeNotifyClientSms(phone, data.id, service, name);
            setCart([]); setPhone(''); setName(''); setAddr(''); setNotes(''); setPayOnDelivery(false); setTableNum('');
        } else {
            alert("❌ Error: " + error?.message);
        }
    } catch (err) {
        alert("❌ Error de conexión");
    } finally {
        setLoading(false);
    }
  };

  const getPDF = async () => {
    if (!lastOrder) return null;
    
    const settings = {
        business_name: ticketConfig.nombre_tienda,
        business_address: ticketConfig.direccion_tienda, 
        business_phone: ticketConfig.telefono_tienda,    
        footer_text: ticketConfig.footer_ticket,         
        
        paper_width: ticketConfig.ancho_papel || '58',
        show_logo: String(ticketConfig.show_logo) === 'true',
        show_notes: true,
        show_client: true,
        logo_url: ticketConfig.logo_url,
        
        facebook: ticketConfig.facebook,
        instagram: ticketConfig.instagram,
        wifi_pass: ticketConfig.wifi_pass,
        website: ticketConfig.website
    };
    
    return await generateTicketPDF(lastOrder, settings, '--- Ticket ---');
  };

  const handlePrintCommand = async () => {
    const blob = await getPDF();
    if(blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }
  };

  const handleWhatsApp = async () => {
    if(!lastOrder) return;
    const blob = await getPDF();
    if(!blob) return;

    const file = new File([blob], `ticket_${lastOrder.id}.pdf`, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'Ticket', text: `Pedido #${lastOrder.id}` });
            return;
        } catch (e) { }
    }
    const msg = encodeURIComponent(`Hola ${lastOrder.client_name}, tu pedido #${lastOrder.id} fue recibido. Total: S/ ${lastOrder.total.toFixed(2)}`);
    window.open(`https://wa.me/51${lastOrder.client_phone}?text=${msg}`, '_blank');
  };

  const filtered = cat === 'Todos' ? products : products.filter(p => p.category === cat);
  const subtotal = cart.reduce((a, b) => a + b.price * b.qty, 0);

  return (
    <div className="flex flex-col h-full gap-2 pb-2 relative text-white">
      
      {/* SECCIÓN PRODUCTOS */}
      <div className="flex-[0_0_35%] flex flex-col min-h-[160px] border-b border-gray-800 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-1 no-scrollbar px-1 shrink-0">
            {['Todos', 'Pizzas', 'Bebidas', 'Extras'].map(c => (
              <button 
                key={c} 
                onClick={() => setCat(c)} 
                className={`px-4 py-1.5 rounded-full font-black text-xs whitespace-nowrap transition-all duration-200 ${
                  cat === c 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-950/50 scale-[1.03]' 
                    : 'bg-gray-850 text-gray-400 border border-gray-800 hover:text-white hover:bg-gray-800'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto p-1 rounded-xl bg-dark/30 flex-1 content-start pr-1 no-scrollbar">
            {filtered.map(p => {
               const inCart = cart.find(i => i.id === p.id);
               return (
              <div 
                key={p.id} 
                onClick={() => updateCart(p, 1)} 
                className={`relative bg-[#1E1E1E]/80 backdrop-blur p-2.5 rounded-2xl border cursor-pointer select-none transition-all duration-200 active:scale-95 flex flex-col justify-between min-h-[75px] ${
                  inCart 
                    ? 'border-orange-500 bg-orange-950/20 shadow-[0_4px_16px_rgba(249,115,22,0.15)] scale-[1.01]' 
                    : 'border-gray-800 hover:border-gray-700 hover:bg-[#252528]'
                }`}
              >
                <div className="font-extrabold text-white text-xs leading-tight whitespace-normal break-words max-w-full leading-snug">{p.name}</div>
                <div className="text-orange-400 font-black text-[13px] mt-1">S/ {p.price.toFixed(2)}</div>
                {inCart && (
                  <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-lg border border-black/20 animate-scale-up">
                    {inCart.qty}
                  </div>
                )}
              </div>
            )})}
          </div>
      </div>

      {/* SECCIÓN CARRITO Y FORMULARIO */}
      <div className="flex-1 flex flex-col bg-card rounded-t-3xl border-t-4 border-orange-500 shadow-2xl overflow-hidden h-full">
        
        <div className="bg-gray-850 px-3 py-2.5 flex justify-between items-center text-xs text-gray-300 font-black shadow-md z-10 shrink-0 border-b border-gray-800">
            <span className="flex items-center gap-1.5 text-orange-400"><ShoppingCart size={15}/> {cart.length} ITEMS</span>
            <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-white/5 transition-colors" title="Vaciar carrito">
                    <Trash2 size={15}/>
                  </button>
                )}
                <span className="text-white bg-black/30 px-2.5 py-1 rounded-xl font-black">Total: S/ {(subtotal + getDeliveryCost()).toFixed(2)}</span>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-gray-900/50 p-2 space-y-1">
            {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 text-xs italic">
                    <ShoppingCart size={32} className="mb-2 opacity-20"/>
                    Agrega productos arriba
                </div>
            ) : (
                cart.map(i => (
                    <div key={i.id} className="flex justify-between items-center bg-dark p-2 rounded border border-gray-800 shadow-sm">
                        <div className="flex-1 pr-2">
                            <div className="font-bold text-white text-sm leading-tight whitespace-normal break-words max-w-full leading-snug">{i.name}</div>
                            <div className="text-[10px] text-gray-500">S/ {i.price} c/u</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={()=>updateCart(i, -1)} className="text-red-400 p-1 bg-gray-800 rounded hover:bg-gray-700"><Minus size={16}/></button>
                            <span className="font-bold w-4 text-center text-sm text-white">{i.qty}</span>
                            <button onClick={()=>updateCart(i, 1)} className="text-green-400 p-1 bg-gray-800 rounded hover:bg-gray-700"><Plus size={16}/></button>
                        </div>
                    </div>
                ))
            )}
        </div>

        <div className="bg-dark p-2 space-y-2 border-t border-gray-800 z-20 shrink-0 pb-safe">
             <div className="flex gap-2">
                 <div className="relative w-28 shrink-0">
                     <Phone size={14} className="absolute top-2.5 left-2 text-gray-500"/>
                     <input className="bg-card p-2 pl-7 rounded w-full text-white text-xs border border-gray-700 outline-none h-9" placeholder="999..." maxLength={9} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} />
                 </div>
                 <div className="relative flex-1">
                     <User size={14} className="absolute top-2.5 left-2 text-gray-500"/>
                     <input className="bg-card p-2 pl-7 rounded w-full text-white text-xs border border-gray-700 outline-none h-9 whitespace-normal break-words max-w-full leading-snug" placeholder="Nombre Cliente" value={name} onChange={e => setName(e.target.value)} />
                 </div>
             </div>
             
             <div className="flex gap-2 items-center">
                  <div className="flex bg-black/45 border border-gray-800 rounded-xl p-0.5 w-[140px] shrink-0 h-9">
                    {['Delivery', 'Local'].map((srv) => (
                      <button
                        key={srv}
                        type="button"
                        onClick={() => setService(srv)}
                        className={`flex-1 text-center text-xs font-black rounded-lg transition-all ${
                          service === srv
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                            : 'text-gray-400 hover:text-white bg-transparent'
                        }`}
                      >
                        {srv}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex-1">
                      {service === 'Local' ? (
                         <>
                             <Armchair size={14} className="absolute top-2.5 left-2 text-orange-500"/>
                             <input className="w-full bg-card p-2 pl-7 rounded text-white text-xs border border-orange-500/50 outline-none focus:border-orange-500 font-bold h-9" placeholder="N° Mesa" value={tableNum} onChange={e => setTableNum(e.target.value)} />
                         </>
                      ) : (
                         <div className="flex gap-1 items-center">
                              <div className="flex bg-black/45 border border-gray-800 rounded-xl p-0.5 shrink-0 h-9 w-[180px]">
                                {[
                                  { key: 'costo_cerca', label: 'Cerca' },
                                  { key: 'costo_lejos', label: 'Lejos' },
                                  { key: 'gratis', label: 'S/0' },
                                ].map((item) => (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setCostKey(item.key)}
                                    className={`flex-1 text-center text-[10px] font-black rounded-lg transition-all ${
                                      costKey === item.key
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-white bg-transparent'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                              <div className="relative flex-1">
                                 <MapPin size={14} className="absolute top-2.5 left-2 text-gray-500"/>
                                 <input className="w-full bg-card p-2 pl-7 rounded text-white text-xs border border-gray-700 outline-none h-9 focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500" placeholder="Dirección" value={addr} onChange={e => setAddr(e.target.value)} />
                              </div>
                         </div>
                      )}
                  </div>
              </div>
             
             <div className="flex gap-2 items-center">
                 <div className="relative flex-1">
                    <FileText size={14} className="absolute top-2.5 left-2 text-yellow-500"/>
                    <input className="w-full bg-card p-2 pl-7 rounded text-yellow-500 text-xs border border-gray-700 italic outline-none h-9" placeholder="Nota cocina..." value={notes} onChange={e => setNotes(e.target.value)} />
                 </div>
                 {service === 'Delivery' && (
                     <label className="flex items-center gap-1 text-[10px] font-bold cursor-pointer bg-gray-800 p-2 rounded h-9 shrink-0 px-3 hover:bg-gray-700 border border-gray-700">
                         <input type="checkbox" checked={payOnDelivery} onChange={e => setPayOnDelivery(e.target.checked)} className="accent-orange-500 w-4 h-4"/> 
                         <span>Contraentrega</span>
                     </label>
                 )}
             </div>

            <button onClick={sendOrder} disabled={loading} className="w-full bg-orange-600 py-3 rounded-xl font-bold text-lg text-white flex justify-center items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 hover:bg-orange-500 h-12">
                {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                <span>ENVIAR A COCINA</span> 
            </button>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 border border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.3)] text-center relative">
                <button onClick={() => setShowSuccessModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-white p-2"><X/></button>
                <div className="flex justify-center mb-4"><div className="bg-green-500/20 p-4 rounded-full text-green-500 animate-bounce"><CheckCircle size={48} /></div></div>
                <h2 className="text-2xl font-black text-white mb-1">¡Orden Enviada!</h2>
                <p className="text-gray-400 mb-6">Pedido #{lastOrder?.id} registrado correctamente</p>

                <div className="space-y-3">
                    <button onClick={handlePrintCommand} className="w-full bg-yellow-600 hover:bg-yellow-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-lg transition-transform active:scale-95">
                        <Printer size={20}/> IMPRIMIR TICKET
                    </button>
                    
                    <button onClick={handleWhatsApp} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-lg transition-transform active:scale-95">
                        <Share2 size={20}/> ENVIAR WHATSAPP
                    </button>
                </div>

                <button onClick={() => setShowSuccessModal(false)} className="mt-6 w-full py-3 rounded-lg border border-gray-700 text-gray-300 font-bold hover:bg-gray-800">
                    Nueva Orden
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
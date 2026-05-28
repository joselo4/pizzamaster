import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, logAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { type Order } from '../types';
import { generateTicketPDF } from '../lib/ticket';
import { DollarSign, Printer, CreditCard, Banknote, Loader2, Armchair, X, Pencil } from 'lucide-react';
import EditOrderModal from '../components/orders/EditOrderModal';

export default function Cashier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [ticketConfig, setTicketConfig] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('config').select('*').then(({ data }) => {
        const c: any = {};
        data?.forEach((row:any) => c[row.key] = row.numeric_value || row.text_value);
        setTicketConfig(c);
    });
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_status', 'Pendiente')
      .neq('status', 'Cancelado')
      .order('created_at', { ascending: true });
    setOrders(data || []);
  };

  useEffect(() => {
    fetchOrders();
    const sub = supabase.channel('cashier').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const openEditor = (o: Order) => {
    setEditing(o);
    setOpenEdit(true);
  };

  const handlePay = async () => {
    if (!selectedOrder) return;
    setLoading(true);

    const { error } = await supabase.from('orders').update({
        payment_status: 'Pagado',
        payment_method: paymentMethod,
        final_payment_method: paymentMethod
    }).eq('id', selectedOrder.id);

    if (error) {
        alert("Error al procesar cobro");
        setLoading(false);
        return;
    }

    logAction(user!.username, 'COBRO', `Orden #${selectedOrder.id} - S/${selectedOrder.total}`, selectedOrder.id);
    setLoading(false);
    setSelectedOrder(null);
    fetchOrders();
  };

  const handlePrint = async (order: Order, method: string) => {
    const orderToPrint = { ...order, payment_method: method }; 
    const settings = {
        business_name: ticketConfig.nombre_tienda,
        business_address: ticketConfig.direccion_tienda, 
        business_phone: ticketConfig.telefono_tienda,    
        footer_text: ticketConfig.footer_ticket,         
        
        paper_width: ticketConfig.ancho_papel || '58',
        show_logo: String(ticketConfig.show_logo) === 'true',
        show_notes: String(ticketConfig.show_notes) !== 'false',
        show_client: String(ticketConfig.show_client) !== 'false',
        logo_url: ticketConfig.logo_url,
        
        // Redes Sociales y Extras
        facebook: ticketConfig.facebook,
        instagram: ticketConfig.instagram,
        tiktok: ticketConfig.tiktok, // NUEVO
        wifi_pass: ticketConfig.wifi_pass,
        website: ticketConfig.website,
        extra_socials: ticketConfig.extra_socials // JSON
    };

    const blob = await generateTicketPDF(orderToPrint, settings, '--- Ticket ---');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0b0b0d] text-zinc-900 dark:text-white w-full transition-colors duration-300">
      <div className="p-4 border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-[#1E1E1E] shadow-md z-10 flex justify-between items-center shrink-0">
        <h2 className="text-xl font-black text-zinc-800 dark:text-white flex items-center gap-2">
            <DollarSign className="text-emerald-500" /> CAJA <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">({orders.length} pendientes)</span>
        </h2>
        <button 
          type="button" 
          onClick={() => navigate('/cashier/history')} 
          className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/10 px-4 py-2 text-xs font-black shadow-xs transition"
        >
          Historial
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start pb-40">
        {orders.length === 0 && (
            <div className="col-span-full text-center text-zinc-450 dark:text-zinc-500 mt-10 font-bold text-sm">No hay cobros pendientes</div>
        )}
        
        {orders.map(o => (
            <div 
              key={o.id} 
              onClick={() => setSelectedOrder(o)} 
              className="bg-white dark:bg-[#1E1E1E]/80 border border-zinc-200 dark:border-white/10 p-4 rounded-2xl shadow-sm dark:shadow-lg active:scale-[0.98] transition-all cursor-pointer hover:border-emerald-500 hover:shadow-emerald-500/5 dark:hover:border-emerald-500/40 relative flex flex-col justify-between min-h-[300px]"
            >
                <div className="absolute top-0 right-0 z-10">
                    {o.service_type === 'Local' && o.table_number ? (
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 text-[10px] font-black px-3 py-1.5 rounded-bl-2xl flex items-center gap-1 shadow-md">
                            <Armchair size={12}/> Mesa {o.table_number}
                        </div>
                    ) : (
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-550 text-white text-[10px] font-black px-3 py-1.5 rounded-bl-2xl shadow-md">
                            DELIVERY
                        </div>
                    )}
                </div>

                <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-lg text-zinc-400 dark:text-white/40">#{o.id}</span>
                    </div>
                    
                    <div className="text-zinc-800 dark:text-zinc-100 font-black truncate text-base mb-1 pr-16">{o.client_name}</div>
                    <div className="text-xs text-zinc-500 dark:text-white/40 mb-3">{new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {o.items.length} items</div>
                    
                    <div className="bg-zinc-50 dark:bg-black/25 border border-zinc-150 dark:border-white/5 p-2 rounded-xl text-xs text-zinc-600 dark:text-white/60 overflow-y-auto max-h-[100px] mb-2 space-y-1">
                        {o.items.map((i, idx) => (
                            <div key={idx} className="border-b border-zinc-150/40 dark:border-white/5 pb-0.5 last:border-0 whitespace-normal break-words max-w-full leading-snug">• {i.qty} {i.name}</div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-end border-t border-zinc-150 dark:border-white/5 pt-3 shrink-0">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-black tracking-wider">Método</span>
                        <span className="text-xs font-black text-zinc-700 dark:text-zinc-200">{o.pay_on_delivery ? '🛵 Contraentrega' : '💰 En Caja'}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-black tracking-wider block">Total</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none">S/ {o.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-[32px] border border-zinc-250 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden relative">
                <div className="p-4 border-b border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-gray-900/50 shrink-0 flex justify-between items-center">
                    <h3 className="text-base font-black text-zinc-800 dark:text-white">Detalle de Cobro #{selectedOrder.id}</h3>
                    <button onClick={() => setSelectedOrder(null)} className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-white/60 dark:hover:text-white bg-zinc-100 dark:bg-white/5 rounded-xl transition"><X size={16}/></button>
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    <div className="text-center">
                        <div className="text-sm text-zinc-500 dark:text-white/65 font-black mb-0.5">{selectedOrder.client_name}</div>
                        <div className="text-emerald-650 dark:text-emerald-450 font-black text-5xl">S/ {selectedOrder.total.toFixed(2)}</div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-black/35 p-3 rounded-2xl border border-zinc-150 dark:border-white/5">
                        <div className="space-y-2">
                            {selectedOrder.items.map((i, idx) => (
                                <div key={idx} className="flex justify-between text-xs border-b border-zinc-200/50 dark:border-white/5 pb-1 last:border-0">
                                    <span className="text-zinc-700 dark:text-zinc-250 font-bold whitespace-normal break-words max-w-full leading-snug">{i.qty} x {i.name}</span>
                                    <span className="text-zinc-500 dark:text-white/45">S/ {(i.price * i.qty).toFixed(2)}</span>
                                </div>
                            ))}
                            {selectedOrder.delivery_cost > 0 && (
                                <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 font-black pt-1">
                                    <span>Envío</span>
                                    <span>S/ {selectedOrder.delivery_cost.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-2 block">Seleccionar Método de Pago</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setPaymentMethod('Efectivo')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${paymentMethod === 'Efectivo' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white dark:text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/10' : 'bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/10'}`}>
                                <Banknote size={24}/> <span className="font-black text-xs">Efectivo</span>
                            </button>
                            <button onClick={() => setPaymentMethod('Yape/Plin')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${paymentMethod === 'Yape/Plin' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-purple-400 shadow-md shadow-purple-500/10' : 'bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-white/10'}`}>
                                <CreditCard size={24}/> <span className="font-black text-xs">Yape / Plin</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 pb-6 bg-zinc-50/80 dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/5 flex flex-col gap-2 shrink-0 z-20 shadow-lg">
                    <button onClick={handlePay} disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 text-white dark:text-slate-950 py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">
                        {loading ? <Loader2 className="animate-spin"/> : <DollarSign size={20}/>}
                        <span>REGISTRAR COBRO</span>
                    </button>
                    <button onClick={() => openEditor(selectedOrder)} className="w-full bg-white hover:bg-zinc-50 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs border border-zinc-200 dark:border-white/10 transition">
                        <Pencil size={14}/> Editar pedido
                    </button>
                    <button onClick={() => handlePrint(selectedOrder, paymentMethod)} className="w-full bg-white hover:bg-zinc-50 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs border border-zinc-200 dark:border-white/10 transition">
                        <Printer size={14}/> Solo ver Ticket
                    </button>
                </div>
            </div>
        </div>
      )}

      <EditOrderModal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        order={editing}
        onSaved={(u) => {
          setSelectedOrder(u);
          setEditing(u);
          setOpenEdit(false);
          void fetchOrders();
        }}
      />
    </div>
  );
}

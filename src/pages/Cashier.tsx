import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, logAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { type Order } from '../types';
import { generateTicketPDF } from '../lib/ticket';
import { DollarSign, Printer, CreditCard, Banknote, Loader2, Armchair, X } from 'lucide-react';

export default function Cashier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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
    <div className="flex flex-col h-full bg-dark w-full">
      <div className="p-4 border-b border-gray-800 bg-card shadow-md z-10 flex justify-between items-center shrink-0">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
            <DollarSign className="text-green-500" /> CAJA <span className="text-sm text-gray-500">({orders.length} pendientes)</span>
        </h2>
            <button type="button" onClick={() => navigate('/cashier/history')} className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700">Historial</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start pb-40">
        {orders.length === 0 && (
            <div className="col-span-full text-center text-gray-500 mt-10">No hay cobros pendientes</div>
        )}
        
        {orders.map(o => (
            // CORRECCIÓN: min-h-[300px] para espacio suficiente
            <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-card border border-gray-800 p-4 rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer hover:border-green-500 relative flex flex-col justify-between min-h-[300px]">
                
                <div className="absolute top-0 right-0 z-10">
                    {o.service_type === 'Local' && o.table_number ? (
                        <div className="bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-md">
                            <Armchair size={12}/> Mesa {o.table_number}
                        </div>
                    ) : (
                        <div className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl shadow-md">
                            DELIVERY
                        </div>
                    )}
                </div>

                <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-lg text-white">#{o.id}</span>
                    </div>
                    
                    <div className="text-gray-200 font-bold truncate text-base mb-1 pr-16">{o.client_name}</div>
                    <div className="text-xs text-gray-500 mb-3">{new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {o.items.length} items</div>
                    
                    <div className="bg-black/20 p-2 rounded text-xs text-gray-400 overflow-y-auto max-h-[100px] mb-2 space-y-1">
                        {o.items.map((i, idx) => (
                            <div key={idx} className="border-b border-white/5 pb-0.5 last:border-0 whitespace-normal break-words max-w-full leading-snug">• {i.qty} {i.name}</div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-end border-t border-gray-800 pt-3 shrink-0">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Método</span>
                        <span className="text-xs font-bold text-gray-300">{o.pay_on_delivery ? 'Contraentrega' : 'En Caja'}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider block">Total</span>
                        <span className="text-3xl font-black text-green-500 leading-none">S/ {o.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-card w-full max-w-sm rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden relative">
                <div className="p-4 border-b border-gray-800 bg-gray-900/50 shrink-0 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Orden #{selectedOrder.id}</h3>
                    <button onClick={() => setSelectedOrder(null)} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-full"><X size={20}/></button>
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    <div className="text-center">
                        <div className="text-sm text-gray-400 font-bold mb-1">{selectedOrder.client_name}</div>
                        <div className="text-green-500 font-black text-5xl">S/ {selectedOrder.total.toFixed(2)}</div>
                    </div>

                    <div className="bg-dark/50 p-3 rounded-lg border border-gray-700">
                        <div className="space-y-2">
                            {selectedOrder.items.map((i, idx) => (
                                <div key={idx} className="flex justify-between text-sm border-b border-gray-800 pb-1 last:border-0">
                                    <span className="text-white font-medium whitespace-normal break-words max-w-full leading-snug">{i.qty} x {i.name}</span>
                                    <span className="text-gray-400">S/ {(i.price * i.qty).toFixed(2)}</span>
                                </div>
                            ))}
                            {selectedOrder.delivery_cost > 0 && (
                                <div className="flex justify-between text-sm text-blue-400 font-bold pt-1">
                                    <span>Delivery</span>
                                    <span>S/ {selectedOrder.delivery_cost.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Selecciona Método</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setPaymentMethod('Efectivo')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'Efectivo' ? 'bg-green-600 text-white border-green-500 shadow-lg' : 'bg-dark border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                                <Banknote size={24}/> <span className="font-bold text-sm">Efectivo</span>
                            </button>
                            <button onClick={() => setPaymentMethod('Yape/Plin')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'Yape/Plin' ? 'bg-purple-600 text-white border-purple-500 shadow-lg' : 'bg-dark border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                                <CreditCard size={24}/> <span className="font-bold text-sm">Yape / Plin</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 pb-6 bg-gray-900 border-t border-gray-800 flex flex-col gap-3 shrink-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                    <button onClick={handlePay} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-lg text-lg active:scale-95 transition-transform">
                        {loading ? <Loader2 className="animate-spin"/> : <DollarSign size={24}/>}
                        <span>CONFIRMAR PAGO</span>
                    </button>
                    <button onClick={() => handlePrint(selectedOrder, paymentMethod)} className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm border border-gray-700">
                        <Printer size={16}/> Solo Ver Ticket
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

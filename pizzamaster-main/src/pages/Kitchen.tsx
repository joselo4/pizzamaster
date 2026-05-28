import { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { type Order } from '../types';
import { Clock, ChefHat, AlertCircle, Store, Bike } from 'lucide-react';
import { openSmsComposer } from '../lib/smsDevice';
import { buildStatusSmsMessage } from '../lib/smsTemplates';
import { getConfigCache } from '../lib/configCache';

export default function Kitchen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    const { data } = await supabase.from('orders').select('*').in('status', ['Pendiente', 'Horno']).order('created_at', { ascending: true });
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const sub = supabase.channel('kitchen_orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const maybeNotifyClientSms = (order: Order, nextStatus: string) => {
    if (!order?.client_phone) return;
    const ok = window.confirm(`¿Enviar SMS al cliente (${order.client_phone}) con el estado: ${nextStatus}?`);
    if (!ok) return;
    const cfg = getConfigCache();
    const track = String(order.id).toString(36).toUpperCase();
    const msg = buildStatusSmsMessage({
      orderId: order.id,
      status: nextStatus,
      serviceType: order.service_type,
      clientName: order.client_name,
      storeName: cfg.nombre_tienda || 'Pizzería',
      trackingCode: track,
    });
    openSmsComposer(order.client_phone, msg);
  };

  const advanceOrder = async (order: Order) => {
    const nextStatus = order.status === 'Pendiente' ? 'Horno' : 'Listo';
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: nextStatus as any } : o).filter(o => o.status !== 'Listo'));
    const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);
    if (!error) {
      logAction(user?.username || 'Cocina', 'AVANZAR_PEDIDO', `${order.status} -> ${nextStatus}`, order.id);
      maybeNotifyClientSms(order, nextStatus);
    } else {
      fetchOrders();
      alert("Error al actualizar");
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center text-orange-500 animate-pulse">Cargando cocina...</div>;

  return (
    <div className="flex flex-col h-full bg-dark w-full">
      <div className="p-4 border-b border-gray-800 bg-card shadow-md z-10 flex justify-between items-center shrink-0">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ChefHat className="text-orange-500" /> COCINA <span className="text-sm text-gray-500">({orders.length})</span>
        </h2>
      </div>

      <div 
        className="flex-1 w-full overflow-x-auto flex flex-nowrap gap-4 snap-x snap-mandatory px-4 py-4 items-center"
        style={{ WebkitOverflowScrolling: 'touch' }} 
      >
        {orders.length === 0 ? (
            <div className="w-full text-center text-gray-500 flex flex-col items-center opacity-50">
                <ChefHat size={64} className="mb-4"/>
                <p>Todo tranquilo por aquí...</p>
            </div>
        ) : (
            orders.map(order => (
              <div 
                key={order.id} 
                className={`
                  relative flex-shrink-0 w-[85vw] max-w-sm h-[90%] bg-card rounded-2xl border-2 
                  snap-center flex flex-col shadow-2xl transition-transform overflow-hidden
                  ${order.status === 'Pendiente' ? 'border-orange-500 shadow-orange-900/20' : 'border-yellow-500 shadow-yellow-900/20'}
                `}
              >
                <div className={`p-4 ${order.status === 'Pendiente' ? 'bg-orange-600' : 'bg-yellow-600'} text-white font-bold flex flex-col gap-1 rounded-t-xl shrink-0`}>
                    <div className="flex justify-between items-center">
                        <span className="text-lg">#{order.id}</span>
                        <span className="text-xs bg-black/30 px-2 py-1 rounded flex items-center gap-1"><Clock size={12}/> {new Date(order.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    {/* INDICADOR LOCAL/DELIVERY */}
                    <div className="flex items-center gap-2 text-xs font-bold uppercase bg-black/20 self-start px-2 py-0.5 rounded">
                        {order.service_type === 'Local' ? <Store size={12}/> : <Bike size={12}/>}
                        {order.service_type} {order.table_number && `- Mesa ${order.table_number}`}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-dark/50">
                    {order.notes && (
                        <div className="bg-red-900/30 border border-red-500/50 p-2 rounded text-red-200 text-sm font-bold flex gap-2 items-start mb-2"><AlertCircle size={16} className="mt-0.5 shrink-0"/> <span>NOTA: {order.notes}</span></div>
                    )}
                    {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-gray-700 pb-2 last:border-0">
                            <div className="flex items-center gap-3">
                                <span className="bg-gray-700 text-white font-black w-8 h-8 flex items-center justify-center rounded-lg text-lg">{item.qty}</span>
                                <span className="text-gray-200 font-bold text-lg leading-tight whitespace-normal break-words max-w-full leading-snug">{item.name}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-gray-800 border-t border-gray-700 shrink-0">
                    <button onClick={() => advanceOrder(order)} className={`w-full py-4 rounded-xl font-black text-xl text-white shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${order.status === 'Pendiente' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-600 hover:bg-green-500'}`}>
                        {order.status === 'Pendiente' ? 'METER AL HORNO 🔥' : '¡ESTÁ LISTO! ✅'}
                    </button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
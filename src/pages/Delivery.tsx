import { useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { type Order } from '../types';
import { Bike, MapPin, Phone, Navigation, CheckSquare, Square, Wallet, FileText, AlertCircle, Loader2, Armchair } from 'lucide-react';
import { openSmsComposer } from '../lib/smsDevice';
import { buildStatusSmsMessage } from '../lib/smsTemplates';
import { getConfigCache } from '../lib/configCache';

export default function Delivery() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false);
  const [bulkSmsOrders, setBulkSmsOrders] = useState<Order[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  
  const fetchOrders = async () => {
    const { data } = await supabase.from('orders').select('*').in('status', ['Listo', 'En Transporte']).order('created_at', { ascending: true });
    setOrders(data || []);
  };

  useEffect(() => {
    fetchOrders();
    const sub = supabase.channel('delivery_orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const isRouteInProgress = orders.some(o => o.status === 'En Transporte');
  
  // Filtro visual
  const visibleOrders = orders.filter(o => {
      if (isRouteInProgress) return o.status === 'En Transporte';
      return o.status === 'Listo';
  });

  const toggleSelect = (id: number) => {
      if (isRouteInProgress) return;
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

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

  const buildSmsForOrder = (order: Order, status: string) => {
    const cfg = getConfigCache();
    const track = String(order.id).toString(36).toUpperCase();
    return buildStatusSmsMessage({
      orderId: order.id,
      status,
      serviceType: order.service_type,
      clientName: order.client_name,
      storeName: cfg.nombre_tienda || 'Pizzería',
      trackingCode: track,
    });
  };

  const openBulkSmsPanel = (status: string) => {
    if (selectedIds.length === 0) return;
    const list = orders.filter(o => selectedIds.includes(o.id) && !!o.client_phone);
    if (list.length === 0) {
      alert('No hay teléfonos disponibles en los pedidos seleccionados.');
      return;
    }
    const ok = window.confirm(`¿Abrir panel de SMS para ${list.length} pedido(s) con estado: ${status}?`);
    if (!ok) return;
    setBulkSmsOrders(list);
    setBulkSmsOpen(true);
  };


  const startRouteMultiple = async () => {
      if (selectedIds.length === 0 || isRouteInProgress || loadingRoute) return;
      setLoadingRoute(true);
      const idsToProcess = selectedIds; 
      
      setOrders(prev => prev.map(o => idsToProcess.includes(o.id) ? { ...o, status: 'En Transporte' as any } : o));
      setSelectedIds([]);

      for (const id of idsToProcess) {
          await supabase.from('orders').update({ status: 'En Transporte', delivery_by: user?.username }).eq('id', id);
      }
      logAction(user?.username || 'Reparto', 'INICIO_RUTA', `Pedidos: ${idsToProcess.join(', ')}`);
      setLoadingRoute(false);
  };

  const completeOrder = async (order: Order) => {
    const nextStatus = order.status === 'Listo' ? 'En Transporte' : 'Entregado';
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: nextStatus as any } : o).filter(o => o.status !== 'Entregado'));
    await supabase.from('orders').update({ status: nextStatus, delivery_by: user?.username }).eq('id', order.id);
     maybeNotifyClientSms(order, nextStatus);
    logAction(user?.username || 'Reparto', 'ENTREGA', `Pedido #${order.id} -> ${nextStatus}`);
  };

  const openMap = (address: string) => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  const callClient = (phone: string) => window.open(`tel:${phone}`);

  return (
    <div className="flex flex-col h-full bg-dark w-full relative">
          {bulkSmsOpen && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl bg-card border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <div className="font-black text-lg">SMS para pedidos seleccionados</div>
                    <div className="text-white/60 text-sm">Toca "Abrir SMS" para cada pedido. El navegador abrirá la app de mensajes del celular.</div>
                  </div>
                  <button
                    onClick={() => { setBulkSmsOpen(false); setBulkSmsOrders([]); }}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
                  {bulkSmsOrders.map(o => {
                    const msg = buildSmsForOrder(o, 'Listo');
                    return (
                      <div key={o.id} className="p-4 rounded-xl bg-black/20 border border-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black">Pedido #{o.id} — {o.client_name || 'Cliente'}</div>
                            <div className="text-white/60 text-sm">Tel: {o.client_phone || '—'}</div>
                            <div className="text-white/60 text-xs mt-1">Dirección: {o.client_address || '—'}</div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => openSmsComposer(o.client_phone || '', msg)}
                              className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 font-black"
                            >
                              Abrir SMS
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(msg);
                                  alert('Mensaje copiado.');
                                } catch {
                                  alert('No se pudo copiar.');
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 text-xs whitespace-pre-wrap text-white/80 bg-black/30 rounded-xl p-3">{msg}</div>
                      </div>
                    );
                  })}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={async () => {
                        const all = bulkSmsOrders
                          .map(o => `Pedido #${o.id} (${o.client_phone || ''})\n${buildSmsForOrder(o, 'Listo')}\n--------------------`)
                          .join('\n');
                        try {
                          await navigator.clipboard.writeText(all);
                          alert('Todos los mensajes fueron copiados.');
                        } catch {
                          alert('No se pudo copiar.');
                        }
                      }}
                      className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20"
                    >
                      Copiar todos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
      <div className="p-4 border-b border-gray-800 bg-card shadow-md z-10 flex justify-between items-center shrink-0">
        <h2 className="text-xl font-black text-white flex items-center gap-2"><Bike className="text-blue-500" /> REPARTO <span className="text-sm text-gray-500">({visibleOrders.length})</span></h2>
        
        {!isRouteInProgress && selectedIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <button onClick={() => openBulkSmsPanel('Listo')} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-2">
                <span>SMS ({selectedIds.length})</span>
              </button>
              <button onClick={startRouteMultiple} disabled={loadingRoute} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full font-bold text-xs animate-in fade-in slide-in-from-right-10 shadow-lg flex items-center gap-2">
                {loadingRoute ? <Loader2 className="animate-spin" size={14}/> : <Bike size={14}/>}
                <span>INICIAR ({selectedIds.length})</span>
            </button>
            </div>
        ) : isRouteInProgress && (
            <div className="bg-blue-900/50 text-blue-200 px-3 py-1 rounded text-xs font-bold border border-blue-500/30 animate-pulse">Ruta en curso</div>
        )}
      </div>

      <div className="flex-1 w-full overflow-x-auto flex flex-nowrap gap-4 snap-x snap-mandatory px-4 py-4 items-center">
        {visibleOrders.length === 0 ? (
             <div className="w-full text-center text-gray-500 flex flex-col items-center opacity-50"><Bike size={64} className="mb-4"/><p>{isRouteInProgress ? 'Ruta completada' : 'Sin pedidos listos'}</p></div>
        ) : (
            visibleOrders.map(order => (
              <div key={order.id} className={`relative flex-shrink-0 w-[85vw] max-w-sm h-[95%] bg-card rounded-2xl border-2 snap-center flex flex-col shadow-2xl overflow-hidden transition-all ${selectedIds.includes(order.id) ? 'border-blue-500 shadow-blue-500/20' : 'border-blue-900/50'}`}>
                 
                 <div className={`p-4 ${order.status === 'Listo' ? 'bg-blue-900/40' : 'bg-green-900/40'} border-b border-gray-700 flex justify-between items-center shrink-0`}>
                    <div className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                        {order.service_type === 'Local' ? <><Armchair size={16}/> MESA {order.table_number}</> : <><Bike size={16}/> {order.status === 'Listo' ? 'LISTO' : 'EN CAMINO'}</>}
                    </div>
                    {order.status === 'Listo' && !isRouteInProgress && order.service_type === 'Delivery' && (
                         <button onClick={() => toggleSelect(order.id)} className="p-1 -mr-2 text-white">
                             {selectedIds.includes(order.id) ? <CheckSquare className="text-blue-500 fill-blue-500/20" size={30}/> : <Square className="text-gray-500" size={30}/>}
                         </button>
                     )}
                 </div>

                 <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto" onClick={() => !isRouteInProgress && order.status === 'Listo' && order.service_type === 'Delivery' && toggleSelect(order.id)}>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">{order.client_name}</h3>
                        {order.service_type === 'Delivery' && (
                            <div className="flex items-start gap-2 text-gray-400 text-sm mb-2"><MapPin size={16} className="mt-1 shrink-0 text-blue-500"/><span className="leading-tight">{order.client_address || 'Sin dirección'}</span></div>
                        )}
                        {order.service_type === 'Delivery' && (
                            <div className="flex gap-2">
                                <button onClick={(e) => {e.stopPropagation(); openMap(order.client_address || '')}} className="flex-1 bg-gray-800 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-700"><Navigation size={14}/> MAPA</button>
                                <button onClick={(e) => {e.stopPropagation(); callClient(order.client_phone)}} className="flex-1 bg-gray-800 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-700"><Phone size={14}/> LLAMAR</button>
                            </div>
                        )}
                    </div>

                    {/* ALERTA PAGO CONTRAENTREGA */}
                    {order.pay_on_delivery ? (
                        <div className="bg-red-900/30 p-3 rounded-xl border-l-4 border-red-500 flex justify-between items-center animate-pulse">
                            <div>
                                <div className="text-[10px] text-red-300 font-bold uppercase flex items-center gap-1"><Wallet size={12}/> COBRAR</div>
                                <div className="text-2xl font-black text-white">S/ {order.total.toFixed(2)}</div>
                            </div>
                            <div className="text-xs text-red-200 bg-red-900/50 px-2 py-1 rounded">Efectivo</div>
                        </div>
                    ) : (
                        <div className="bg-green-900/20 p-3 rounded-xl border border-green-900/50 flex justify-between items-center">
                            <span className="text-sm text-green-400 font-bold">PAGADO</span>
                            <span className="text-gray-500 text-sm line-through">S/ {order.total.toFixed(2)}</span>
                        </div>
                    )}

                    {/* NOTAS - Uso de AlertCircle para corregir error */}
                    {order.notes && (
                        <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg flex gap-2 items-start text-yellow-200">
                            <AlertCircle size={16} className="mt-0.5 shrink-0 text-yellow-500"/>
                            <div>
                                <span className="text-[10px] font-bold uppercase text-yellow-500 block">Nota Cocina:</span>
                                <span className="text-sm italic leading-tight">{order.notes}</span>
                            </div>
                        </div>
                    )}
                    
                    {/* LISTA - Uso de FileText para corregir error */}
                    <div className="bg-dark/30 p-2 rounded">
                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1">
                            <FileText size={10}/> Detalles del Pedido:
                        </div>
                        <div className="space-y-1">
                            {order.items.map((i, idx) => (<div key={idx} className="text-sm text-gray-300 border-b border-white/5 pb-1 last:border-0 flex justify-between"><span>{i.qty} {i.name}</span></div>))}
                        </div>
                    </div>
                 </div>

                 <div className="p-4 bg-gray-800 border-t border-gray-700 shrink-0">
                    <button 
                        onClick={(e) => {e.stopPropagation(); completeOrder(order)}} 
                        className={`w-full py-4 rounded-xl font-black text-lg text-white shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${order.status === 'Listo' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}
                    >
                        {order.status === 'Listo' ? (order.service_type === 'Local' ? 'SERVIDO EN MESA' : 'INICIAR INDIVIDUAL') : 'ENTREGADO ✅'}
                    </button>
                 </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}


import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Order, OrderRequest } from '../types';
import { openWhatsApp, STORE_WA_NUMBER } from '../lib/whatsapp';
import { Clock, CheckCircle2, ChefHat, Bike, ShoppingBag, XCircle } from 'lucide-react';

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function money(n: number) {
  return `S/ ${Number(n||0).toFixed(2)}`;
}

export default function Track() {
  const { token } = useParams();
  const [req, setReq] = useState<OrderRequest | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    if (!token) return;
    setError('');
    try {
      const { data: r, error: e1 } = await supabase.from('order_requests').select('*').eq('public_token', token).single();
      if (e1) throw e1;
      setReq(r as any);
      const mapped = (r as any).mapped_order_id;
      if (mapped) {
        const { data: o, error: e2 } = await supabase.from('orders').select('*').eq('id', mapped).single();
        if (!e2 && o) setOrder(o as any);
      }
    } catch (e: any) {
      setError(e?.message || 'No se encontró el pedido.');
    }
  };

  useEffect(() => {
    load();
    if (!token) return;

    const subReq = supabase.channel('track_req_' + token)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, (payload) => {
        const row: any = payload.new;
        if (row?.public_token === token) {
          setReq(row);
        }
      })
      .subscribe();

    const subOrders = supabase.channel('track_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row: any = payload.new;
        if ((req as any)?.mapped_order_id && row?.id === (req as any).mapped_order_id) {
          setOrder(row as any);
        }
      })
      .subscribe();

    const interval = window.setInterval(load, 8000);

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(subReq);
      supabase.removeChannel(subOrders);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const estimatedText = useMemo(() => {
    if (!req) return '';
    const mins = req.estimated_minutes || 40;
    const start = new Date(req.created_at).getTime();
    const eta = new Date(start + mins * 60_000);
    return `Estimado: ${mins} min • Aprox: ${eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [req]);

  const statusLabel = useMemo(() => {
    if (!req) return '';
    if (order) return order.status;
    return req.status;
  }, [req, order]);

  const steps = useMemo(() => {
    const s = statusLabel;
    const isRejected = s === 'Rechazado' || s === 'Cancelado';
    if (isRejected) {
      return [
        { key: 'rechazado', label: 'Rechazado', icon: <XCircle className="text-red-400"/> }
      ];
    }

    return [
      { key: 'recibido', label: 'Recibido', icon: <ShoppingBag className="text-orange-400"/> },
      { key: 'validacion', label: 'Validación', icon: <CheckCircle2 className="text-white/60"/> },
      { key: 'cocina', label: 'Cocina', icon: <ChefHat className="text-white/60"/> },
      { key: 'reparto', label: 'Reparto', icon: <Bike className="text-white/60"/> },
      { key: 'entregado', label: 'Finalizado', icon: <CheckCircle2 className="text-white/60"/> },
    ];
  }, [statusLabel]);

  const highlightIndex = useMemo(() => {
    const s = statusLabel;
    if (s === 'Nuevo' || s === 'En Revisión' || s === 'Observado') return 1;
    if (s === 'Aprobado' || s === 'Pendiente') return 2;
    if (s === 'Horno' || s === 'Listo') return 3;
    if (s === 'En Transporte') return 4;
    if (s === 'Entregado' || s === 'Recogido') return 5;
    return 1;
  }, [statusLabel]);

  const waMessage = useMemo(() => {
    if (!req) return 'Hola, quisiera consultar mi pedido.';
    const trackUrl = `${window.location.origin}/track/${req.public_token}`;
    return `Hola 👋, quisiera confirmar/consultar mi pedido.
Seguimiento: ${trackUrl}`;
  }, [req]);

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold">Seguimiento de pedido</div>
            <div className="text-white/60 text-sm">{req ? `Creado: ${fmtDate(req.created_at)}` : ''}</div>
          </div>
          <Link to="/pedido" className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20">Hacer otro pedido</Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl">
            {error}
            <div className="mt-2 text-sm text-white/60">Revisa que exista la tabla <b>order_requests</b> en Supabase.</div>
          </div>
        )}

        {req && (
          <>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Estado: <span className="text-orange-400">{statusLabel}</span></div>
                  <div className="text-sm text-white/60 flex items-center gap-2"><Clock size={16}/> {estimatedText}</div>
                </div>
                <button onClick={()=>openWhatsApp(waMessage, STORE_WA_NUMBER)} className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-semibold">WhatsApp tienda</button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
              <div className="font-semibold mb-2">Progreso</div>
              <div className="grid grid-cols-5 gap-2">
                {steps.map((st, idx) => {
                  const active = idx+1 <= highlightIndex;
                  return (
                    <div key={st.key} className={`rounded-xl p-3 border ${active ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5'}`}>
                      <div className="mb-2">{st.icon}</div>
                      <div className="text-xs">{st.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="font-semibold mb-2">Detalle</div>
              <div className="text-sm text-white/70">Tipo: {req.service_type === 'Delivery' ? 'Delivery' : 'Recojo'}</div>
              {req.address && <div className="text-sm text-white/70">Dirección: {req.address}</div>}
              <div className="mt-3 space-y-2">
                {req.items.map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div>{i.qty} x {i.name}</div>
                    <div className="text-white/60">{money(i.price)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-white/60">Total estimado</div>
                <div className="text-orange-400 font-bold">{money(req.estimated_total || 0)}</div>
              </div>

              {order && (
                <div className="mt-4 text-xs text-white/50">Orden interna: #{order.id} • Estado cocina: {order.status}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

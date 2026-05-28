
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/logger';

function Card({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-white/50">{title}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/50">{hint}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [funnel, setFunnel] = useState<{
    views: number;
    pedido: number;
    requests: number;
    orders: number;
    convView: number;
    convPedido: number;
  }>({ views: 0, pedido: 0, requests: 0, orders: 0, convView: 0, convPedido: 0 });

  const loadFunnel = async (days: number) => {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const [{ count: views }, { count: pedido }, { count: requests }, { count: orders }] = await Promise.all([
        supabase.from('promo_events').select('*', { count: 'exact', head: true }).eq('event', 'view').gte('created_at', since),
        supabase.from('promo_events').select('*', { count: 'exact', head: true }).eq('event', 'pedido_visit').gte('created_at', since),
        supabase.from('order_requests').select('*', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', since),
      ] as any);
      const v = Number(views || 0);
      const p = Number(pedido || 0);
      const r = Number(requests || 0);
      const o = Number(orders || 0);
      const convView = v > 0 ? (r / v) * 100 : 0;
      const convPedido = p > 0 ? (r / p) * 100 : 0;
      setFunnel({ views: v, pedido: p, requests: r, orders: o, convView, convPedido });
    } catch {
      // No romper si falta tabla/policy
    }
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadFunnel(7);
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      try {
        const { data } = await supabase
          .from('orders')
          .select('id,status,created_at,total,service_type')
          .gte('created_at', since)
          .order('created_at', { ascending: false });
        setOrders(data || []);
      } catch {
        setOrders([]);
      }

      try {
        const { data } = await supabase
          .from('event_log')
          .select('*')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(200);
        setEvents(data || []);
      } catch {
        setEvents([]);
      }

      setLoading(false);
      logEvent({ level: 'info', action: 'admin.dashboard.view' });
    })();
  }, []);

  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const revenue = orders.reduce((a: number, o: any) => a + Number(o?.total || 0), 0);
    const delivery = orders.filter((o) => o?.service_type === 'Delivery').length;
    const local = totalOrders - delivery;

    const counts = events.reduce((acc: any, e: any) => {
      const k = e?.action || 'other';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topActions = Object.entries(counts)
      .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
      .slice(0, 6);

    return { totalOrders, revenue, delivery, local, topActions };
  }, [orders, events]);

  return (
    <div className="p-4">
      <div className="text-xl font-black">Dashboard</div>
      {loading && <div className="mt-4 text-white/70">Cargando…</div>}

      {!loading && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Órdenes (24h)" value={kpis.totalOrders} />
            <Card title="Ingresos (24h)" value={`S/ ${kpis.revenue.toFixed(2)}`} />
            <Card title="Delivery (24h)" value={kpis.delivery} />
            <Card title="Local (24h)" value={kpis.local} />
          </div>

          {/* EMBUDO DE CONVERSIÓN PREMIUM */}
          <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-tr from-white/5 to-white/[0.02] p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="text-orange-500">📊</span> Embudo de Conversión (7d)
                </h3>
                <p className="text-xs text-white/50">Monitorea el flujo de tus clientes desde la publicidad hasta la orden final.</p>
              </div>
              <div className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-sm animate-sparkle">
                Tasa Global: {funnel.views > 0 ? ((funnel.orders / funnel.views) * 100).toFixed(1) : '0.0'}%
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
              {[
                {
                  label: "1. Vistas Landing 👁️",
                  val: funnel.views,
                  hint: "Vieron la publicidad /promo",
                  color: "from-blue-600 to-indigo-505",
                  pct: 100,
                },
                {
                  label: "2. Clics Pedido 🛒",
                  val: funnel.pedido,
                  hint: "Entraron al menú /pedido",
                  color: "from-indigo-500 to-purple-500",
                  pct: funnel.views > 0 ? (funnel.pedido / funnel.views) * 100 : 0,
                },
                {
                  label: "3. Solicitudes 📝",
                  val: funnel.requests,
                  hint: "Enviaron formulario a validar",
                  color: "from-purple-500 to-orange-500",
                  pct: funnel.pedido > 0 ? (funnel.requests / funnel.pedido) * 100 : 0,
                },
                {
                  label: "4. Órdenes 🍕",
                  val: funnel.orders,
                  hint: "Validados y enviados a cocina",
                  color: "from-orange-500 to-emerald-550",
                  pct: funnel.requests > 0 ? (funnel.orders / funnel.requests) * 100 : 0,
                }
              ].map((stage, idx) => (
                <div key={idx} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-orange-500/30 transition-all duration-300 shadow-md">
                  <div>
                    <div className="text-xs font-black text-white/70">{stage.label}</div>
                    <div className="text-2xl font-black text-white mt-1">{stage.val}</div>
                    <div className="text-[10px] text-white/40 mt-0.5 leading-snug">{stage.hint}</div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className="text-white/40">Conversión</span>
                      <span className="text-orange-400">{stage.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${stage.color} rounded-full transition-all duration-1000`}
                        style={{ width: `${stage.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-black">Top eventos</div>
              <ul className="mt-2 space-y-1 text-sm">
                {kpis.topActions.map(([name, cnt]) => (
                  <li key={String(name)} className="flex items-center justify-between">
                    <span className="truncate pr-3">{String(name)}</span>
                    <span className="font-black">{cnt as any}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-black">Eventos recientes</div>
              <ul className="mt-2 space-y-2 text-xs max-h-[360px] overflow-auto">
                {events.map((e) => (
                  <li key={e.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold truncate">{e.action}</div>
                      <div className="text-white/50 shrink-0">{new Date(e.created_at).toLocaleString()}</div>
                    </div>
                    {e.order_id && <div className="mt-1 text-white/60">Pedido: #{e.order_id}</div>}
                    {e.meta && (
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap text-white/70">{JSON.stringify(e.meta, null, 2)}</pre>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

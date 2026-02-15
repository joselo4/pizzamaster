
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
  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(7);
  const [campaignStats, setCampaignStats] = useState<any[]>([]);
  const [promoStats, setPromoStats] = useState<any[]>([]);

  useEffect(() => {
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

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc('rpc_campaign_stats', { p_days: days });
        setCampaignStats((data as any[]) || []);
      } catch {
        setCampaignStats([]);
      }
      try {
        const { data } = await supabase.rpc('rpc_promo_stats', { p_days: days });
        setPromoStats((data as any[]) || []);
      } catch {
        setPromoStats([]);
      }
    })();
  }, [days]);

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

          
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-black">Estadísticas de campañas (ref)</div>
                <div className="text-xs text-white/50">view → pedido_visit → order_request</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setDays(7)} className={"rounded-xl px-3 py-2 text-sm border border-white/10 " + (days===7 ? 'bg-white/10' : 'bg-black/30')}>7 días</button>
                <button onClick={() => setDays(30)} className={"rounded-xl px-3 py-2 text-sm border border-white/10 " + (days===30 ? 'bg-white/10' : 'bg-black/30')}>30 días</button>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="text-white/70">
                  <tr>
                    <th className="text-left py-2">Campaña</th>
                    <th className="text-right py-2">Views</th>
                    <th className="text-right py-2">/pedido</th>
                    <th className="text-right py-2">Pedidos</th>
                    <th className="text-right py-2">Conv</th>
                  </tr>
                </thead>
                <tbody>
                  {(campaignStats||[]).slice(0,12).map((r:any, i:number) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="py-2 font-semibold">{r.campaign_id}</td>
                      <td className="py-2 text-right">{r.views}</td>
                      <td className="py-2 text-right">{r.pedido_visits}</td>
                      <td className="py-2 text-right">{r.order_requests}</td>
                      <td className="py-2 text-right">{r.conv_view_to_order}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="text-lg font-black">Top Promos (por código)</div>
              <div className="text-xs text-white/50">Pedidos enviados por promo_code</div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="text-white/70">
                  <tr>
                    <th className="text-left py-2">Promo</th>
                    <th className="text-right py-2">Pedidos</th>
                    <th className="text-right py-2">Conv</th>
                  </tr>
                </thead>
                <tbody>
                  {(promoStats||[]).slice(0,12).map((r:any, i:number) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="py-2 font-semibold">{r.promo_code}</td>
                      <td className="py-2 text-right">{r.order_requests}</td>
                      <td className="py-2 text-right">{r.conv_view_to_order}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

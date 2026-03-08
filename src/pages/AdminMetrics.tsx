import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const safeNum = (v: any) => Number(v || 0);

function Card({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-white/60">{title}</div>
      <div className="mt-1 text-2xl font-black text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/50">{hint}</div>}
    </div>
  );
}

function getRange(mode: 'hoy' | '7' | '30' | 'custom', fromDate: string, toDate: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  if (mode === 'hoy') {
    const s = startOfDay(now);
    const e = endOfDay(now);
    return { from: s.toISOString(), to: e.toISOString(), label: 'Hoy' };
  }
  if (mode === '7' || mode === '30') {
    const days = mode === '7' ? 7 : 30;
    const s = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: s.toISOString(), to: now.toISOString(), label: `Últimos ${days} días` };
  }
  if (mode === 'custom' && fromDate && toDate) {
    const s = startOfDay(new Date(fromDate + 'T00:00:00'));
    const e = endOfDay(new Date(toDate + 'T00:00:00'));
    return { from: s.toISOString(), to: e.toISOString(), label: `${fromDate} → ${toDate}` };
  }
  const s = startOfDay(now);
  const e = endOfDay(now);
  return { from: s.toISOString(), to: e.toISOString(), label: 'Hoy' };
}

export default function AdminMetrics() {
  const [rangeMode, setRangeMode] = useState<'hoy' | '7' | '30' | 'custom'>('7');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const range = useMemo(() => getRange(rangeMode, fromDate, toDate), [rangeMode, fromDate, toDate]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const [kpi, setKpi] = useState({
    visitsPromo: 0,
    visitsPedido: 0,
    ordersTotal: 0,
    entregados: 0,
    cancelados: 0,
    pagados: 0,
    porCobrar: 0,
    rechazadosTotal: 0,
    reqRechazado: 0,
  });

  const [pay, setPay] = useState({ efectivo: 0, yapePlin: 0, otros: 0 });

  const countExact = async (table: string, build: (q: any) => any) => {
    const q0 = supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', range.from)
      .lte('created_at', range.to);
    const q1 = build(q0);
    const res: any = await q1;
    return safeNum(res?.count);
  };

  const load = async () => {
    setLoading(true);
    setErr('');

    try {
      const [visPromo, visPedido, ordersTotal, entregados, cancelados, pagados, porCobrar, reqRechazado] = await Promise.all([
        countExact('promo_events', (q) => q.eq('event', 'view')),
        countExact('promo_events', (q) => q.eq('event', 'pedido_visit')),
        countExact('orders', (q) => q),
        countExact('orders', (q) => q.eq('status', 'Entregado')),
        countExact('orders', (q) => q.eq('status', 'Cancelado')),
        countExact('orders', (q) => q.eq('payment_status', 'Pagado')),
        countExact('orders', (q) => q.eq('payment_status', 'Pendiente')),
        countExact('order_requests', (q) => q.eq('status', 'Rechazado')),
      ] as any);

      const rechazadosTotal = safeNum(cancelados) + safeNum(reqRechazado);

      setKpi({
        visitsPromo: visPromo,
        visitsPedido: visPedido,
        ordersTotal,
        entregados,
        cancelados,
        pagados,
        porCobrar,
        rechazadosTotal,
        reqRechazado,
      });

      // Método de pago: tu caso = “Yape/Plin” (un solo valor) vs Efectivo
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('payment_method,final_payment_method,created_at')
          .gte('created_at', range.from)
          .lte('created_at', range.to);

        if (error) throw error;

        let efectivo = 0;
        let yapePlin = 0;
        let otros = 0;

        for (const o of (data || []) as any[]) {
          const raw = String(o?.final_payment_method || o?.payment_method || '').trim().toLowerCase();
          if (!raw) { otros++; continue; }
          if (raw === 'yape/plin' || raw.includes('yape/plin') || (raw.includes('yape') && raw.includes('plin'))) { yapePlin++; continue; }
          if (raw.includes('efect')) { efectivo++; continue; }
          otros++;
        }

        setPay({ efectivo, yapePlin, otros });
      } catch {
        setPay({ efectivo: 0, yapePlin: 0, otros: 0 });
      }

    } catch (e: any) {
      const msg = String(e?.message || e || 'No se pudo cargar métricas');
      setErr(msg);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-xl font-black text-white">Métricas</div>
          <div className="text-sm text-white/50">Filtro: {range.label}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
            value={rangeMode}
            onChange={(e) => setRangeMode(e.target.value as any)}
          >
            <option value="hoy">Hoy</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="custom">Rango (fecha)</option>
          </select>
          {rangeMode === 'custom' && (
            <>
              <input
                type="date"
                className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <input
                type="date"
                className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </>
          )}
          <button
            onClick={() => void load()}
            className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-bold text-white hover:bg-orange-500"
          >
            Actualizar
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-800 bg-red-900/20 p-3 text-sm text-red-200">
          <div className="font-bold">Diagnóstico</div>
          <div className="mt-1 opacity-90">{err}</div>
          <div className="mt-1 text-xs text-red-200/80">
            Si aplicaste SQL recién: <span className="font-mono">select pg_notify('pgrst','reload schema');</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-white/60">Cargando…</div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card title="Visitas Promo" value={kpi.visitsPromo} hint="promo_events:view" />
            <Card title="Visitas /pedido" value={kpi.visitsPedido} hint="promo_events:pedido_visit" />
            <Card title="Pedidos realizados" value={kpi.ordersTotal} hint="orders" />
            <Card title="Rechazados" value={kpi.rechazadosTotal} hint="Cancelado + Rechazado" />
          </div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card title="Entregados" value={kpi.entregados} />
            <Card title="Cancelados" value={kpi.cancelados} />
            <Card title="Pagados" value={kpi.pagados} />
            <Card title="Por cobrar" value={kpi.porCobrar} />
          </div>

          <div className="mt-6 rounded-2xl border border-gray-800 bg-card p-4">
            <div className="font-black text-white">Método de pago (conteo)</div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card title="Efectivo" value={pay.efectivo} />
              <Card title="Yape/Plin" value={pay.yapePlin} />
              <Card title="Otros" value={pay.otros} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

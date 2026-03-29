import { useCallback, useEffect, useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import { supabase, SUPABASE_ENV_STATE } from '../lib/supabase';

type ExecutiveMetrics = {
  days: number;
  orders: number;
  orderRequests: number;
  delivered: number;
  cancelled: number;
  promoViews: number;
  promoPedidoVisits: number;
  revenue: number;
  averageTicket: number;
  conversionViewToRequest: number;
  conversionPedidoToRequest: number;
  cancellationRate: number;
  deliveryShare: number;
  localShare: number;
};

const EMPTY_METRICS: ExecutiveMetrics = {
  days: 7,
  orders: 0,
  orderRequests: 0,
  delivered: 0,
  cancelled: 0,
  promoViews: 0,
  promoPedidoVisits: 0,
  revenue: 0,
  averageTicket: 0,
  conversionViewToRequest: 0,
  conversionPedidoToRequest: 0,
  cancellationRate: 0,
  deliveryShare: 0,
  localShare: 0,
};

export function useExecutiveMetrics(initialDays = 7) {
  const [days, setDays] = useState(initialDays);
  const [metrics, setMetrics] = useState<ExecutiveMetrics>({ ...EMPTY_METRICS, days: initialDays });
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!SUPABASE_ENV_STATE.isConfigured) return;
    setIsLoading(true);
    const since = subDays(new Date(), days).toISOString();
    try {
      const [ordersRes, requestsRes, deliveredRes, cancelledRes, deliveryRes, localRes, viewsRes, pedidoVisitRes] = await Promise.all([
        supabase.from('orders').select('total,created_at', { count: 'exact' }).gte('created_at', since),
        supabase.from('order_requests').select('created_at', { count: 'exact' }).gte('created_at', since),
        supabase.from('orders').select('created_at', { count: 'exact', head: true }).eq('status', 'Entregado').gte('created_at', since),
        supabase.from('orders').select('created_at', { count: 'exact', head: true }).in('status', ['Cancelado', 'ANULADA']).gte('created_at', since),
        supabase.from('orders').select('created_at', { count: 'exact', head: true }).eq('order_type', 'delivery').gte('created_at', since),
        supabase.from('orders').select('created_at', { count: 'exact', head: true }).eq('order_type', 'local').gte('created_at', since),
        supabase.from('promo_events').select('created_at', { count: 'exact', head: true }).eq('event', 'view').gte('created_at', since),
        supabase.from('promo_events').select('created_at', { count: 'exact', head: true }).eq('event', 'pedido_visit').gte('created_at', since),
      ] as any);

      const orderRows = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
      const orders = Number(ordersRes?.count || orderRows.length || 0);
      const orderRequests = Number(requestsRes?.count || 0);
      const delivered = Number(deliveredRes?.count || 0);
      const cancelled = Number(cancelledRes?.count || 0);
      const promoViews = Number(viewsRes?.count || 0);
      const promoPedidoVisits = Number(pedidoVisitRes?.count || 0);
      const revenue = orderRows.reduce((sum: number, row: any) => sum + Number(row?.total || 0), 0);
      const deliveryCount = Number(deliveryRes?.count || 0);
      const localCount = Number(localRes?.count || 0);

      setMetrics({
        days,
        orders,
        orderRequests,
        delivered,
        cancelled,
        promoViews,
        promoPedidoVisits,
        revenue,
        averageTicket: orders > 0 ? revenue / orders : 0,
        conversionViewToRequest: promoViews > 0 ? (orderRequests / promoViews) * 100 : 0,
        conversionPedidoToRequest: promoPedidoVisits > 0 ? (orderRequests / promoPedidoVisits) * 100 : 0,
        cancellationRate: orders > 0 ? (cancelled / orders) * 100 : 0,
        deliveryShare: orders > 0 ? (deliveryCount / orders) * 100 : 0,
        localShare: orders > 0 ? (localCount / orders) * 100 : 0,
      });
    } catch {
      setMetrics((prev) => ({ ...prev, days }));
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => { void refresh(); }, [refresh]);

  const narrative = useMemo(() => ({
    conversionLabel: metrics.conversionViewToRequest >= 8 ? 'saludable' : metrics.conversionViewToRequest >= 4 ? 'estable' : 'por reforzar',
    cancellationLabel: metrics.cancellationRate <= 5 ? 'controlada' : metrics.cancellationRate <= 12 ? 'a vigilar' : 'alta',
  }), [metrics]);

  return { metrics, narrative, days, setDays, refresh, isLoading };
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { type Order } from '../types';
import { generateTicketPDF } from '../lib/ticket';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';
import { logBizEvent } from '../lib/observability';
import { useNavigate } from 'react-router-dom';

export default function CashierHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticketConfig, setTicketConfig] = useState<any>({});
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    supabase.from('config').select('*').then(({ data }) => {
      const c: any = {};
      data?.forEach((row: any) => (c[row.key] = row.numeric_value ?? row.text_value));
      setTicketConfig(c);
    });
  }, []);

  const settings = useMemo(() => ({
    business_name: ticketConfig.nombre_tienda,
    business_address: ticketConfig.direccion_tienda,
    business_phone: ticketConfig.telefono_tienda,
    footer_text: ticketConfig.footer_ticket,
    paper_width: ticketConfig.ancho_papel || '58',
    show_logo: String(ticketConfig.show_logo) === 'true',
    show_notes: String(ticketConfig.show_notes) !== 'false',
    show_client: String(ticketConfig.show_client) !== 'false',
    logo_url: ticketConfig.logo_url,
  }), [ticketConfig]);

  const baseQuery = () => {
    // IMPORTANTE: incluir status null (para no perder registros)
    return supabase
      .from('orders')
      .select('*')
      .eq('payment_status', 'Pagado')
      .or('status.is.null,status.neq.Cancelado');
  };

  const fetchHistory = async () => {
    setLoading(true);
    setErr('');
    try {
      let query = baseQuery();

      if (dateFrom) query = query.gte('created_at', new Date(dateFrom + 'T00:00:00').toISOString());
      if (dateTo) query = query.lte('created_at', new Date(dateTo + 'T23:59:59.999').toISOString());

      const term = (q || '').trim();
      if (term) {
        const onlyNum = term.replace(/\D/g, '');
        const asId = Number(onlyNum);
        if (onlyNum && Number.isFinite(asId) && String(asId).length <= 8) query = query.eq('id', asId);
        else query = query.or(`client_name.ilike.%${term}%,client_phone.ilike.%${term}%`);
      }

      // 1) intenta ordenar por updated_at, si falla usa created_at
      let { data, error } = await query.order('updated_at', { ascending: false }).limit(200);
      if (error) {
        const r2 = await query.order('created_at', { ascending: false }).limit(200);
        data = r2.data as any;
        error = r2.error as any;
      }

      if (error) {
        setErr(String(error.message || 'Error consultando historial'));
        setRows([]);
      } else {
        setRows((data as any) || []);
      }

      logBizEvent('cashier.history_search', { dateFrom, dateTo, q: term }, null, user?.username ?? null);
    } catch (e: any) {
      setErr(String(e?.message || e || 'Error consultando historial'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = async (order: Order) => {
    try {
      logBizEvent('ticket_printed', { source: 'cashier_history', method: order.payment_method }, order.id, user?.username ?? null);
      const blob = await generateTicketPDF(order, settings as any, '--- Ticket ---');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    logBizEvent('cashier.history_view', {}, null, user?.username ?? null);
    void fetchHistory();
  }, []);

  return (
    <div className="flex flex-col h-full bg-dark w-full">
      <div className="p-4 border-b border-gray-800 bg-card shadow-md z-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/cashier')} className="p-2 rounded-xl border border-gray-700 text-gray-200 hover:bg-gray-800" title="Volver">
            <ArrowLeft size={18} />
          </button>
          <div className="text-xl font-black text-white">Historial de Cobros</div>
        </div>
        <button onClick={() => void fetchHistory()} className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700">Buscar</button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="rounded-2xl border border-gray-800 bg-card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-xs text-gray-400">Desde</label>
              <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="rounded-xl border border-gray-700 bg-dark px-3 py-2 text-sm text-white" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-400">Hasta</label>
              <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="rounded-xl border border-gray-700 bg-dark px-3 py-2 text-sm text-white" />
            </div>
            <div className="flex-1 flex flex-col min-w-[240px]">
              <label className="text-xs text-gray-400">Buscar (#id, nombre o teléfono)</label>
              <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Ej: 1201 o Juan" className="rounded-xl border border-gray-700 bg-dark px-3 py-2 text-sm text-white" />
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-800 bg-red-900/20 p-3 text-sm text-red-200">{err}</div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-gray-300 flex items-center gap-2"><Loader2 className="animate-spin"/> Cargando…</div>
        ) : (
          <div className="mt-4 grid gap-3">
            {rows.length === 0 ? (
              <div className="text-gray-400">Sin resultados.</div>
            ) : rows.map((o:any) => (
              <div key={o.id} className="rounded-2xl border border-gray-800 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-lg text-white">#{o.id} <span className="text-xs text-gray-400">({o.payment_method || '—'})</span></div>
                    <div className="text-gray-200 font-bold">{o.client_name || '—'}</div>
                    <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-black">S/ {Number(o.total||0).toFixed(2)}</div>
                    <button onClick={() => void handleReprint(o)} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700">
                      <Printer size={16} /> Reimprimir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

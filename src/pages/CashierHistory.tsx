import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { type Order } from '../types';
import { generateTicketPDF } from '../lib/ticket';
import { Printer, Loader2, ArrowLeft, Pencil } from 'lucide-react';
import EditOrderModal from '../components/orders/EditOrderModal';
import { useNavigate } from 'react-router-dom';

export default function CashierHistory() {
  const navigate = useNavigate();
  const [ticketConfig, setTicketConfig] = useState<any>({});
  const [rows, setRows] = useState<any[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageSize, setPageSize] = useState<number>(50);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('config').select('key,numeric_value,text_value').then(({ data }) => {
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
    // Redes sociales + WiFi (para reimpresión en Historial)
    facebook: ticketConfig.facebook,
    instagram: ticketConfig.instagram,
    tiktok: ticketConfig.tiktok,
    website: ticketConfig.website,
    wifi_pass: ticketConfig.wifi_pass,
    extra_socials: ticketConfig.extra_socials,
  }), [ticketConfig]);

  const fetchHistory = async () => {
    setLoading(true);
    setErr('');
    try {
      let query = supabase
        .from('orders')
        .select('id,created_at,client_name,total,payment_method,payment_status,status')
        .eq('payment_status', 'Pagado')
        .or('status.is.null,status.neq.Cancelado')
        .order('created_at', { ascending: false });

      if (dateFrom) query = query.gte('created_at', new Date(dateFrom + 'T00:00:00').toISOString());
      if (dateTo) query = query.lte('created_at', new Date(dateTo + 'T23:59:59.999').toISOString());

      const term = (q || '').trim();
      if (term) {
        const onlyNum = term.replace(/\D/g, '');
        const asId = Number(onlyNum);
        if (onlyNum && Number.isFinite(asId) && String(asId).length <= 8) query = query.eq('id', asId);
        else query = query.or(`client_name.ilike.%${term}%`);
      }

      const { data, error } = await query.limit(pageSize);
      if (error) {
        setErr(error.message || 'Error consultando historial');
        setRows([]);
      } else {
        setRows((data as any) || []);
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = async (row: any) => {
    setErr('');
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('id', row.id).single();
      if (error) throw error;
      setEditing(data as unknown as Order);
      setOpenEdit(true);
    } catch (e: any) {
      setErr(String(e?.message || e || 'No se pudo abrir edición'));
    }
  };

  const handleReprint = async (row: any) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', row.id)
        .single();

      if (error) throw error;

      const blob = await generateTicketPDF(data as unknown as Order, settings as any, '--- Ticket ---');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e: any) {
      setErr(String(e?.message || e || 'No se pudo reimprimir'));
    }
  };

  useEffect(() => {
    void fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0b0b0d] text-zinc-900 dark:text-white w-full transition-colors duration-300">
      <div className="p-4 border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-[#1E1E1E] shadow-md z-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={() => navigate('/cashier')} 
            className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-gray-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition" 
            title="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="text-lg font-black text-zinc-800 dark:text-white">Historial de Cobros</div>
        </div>
        <button 
          onClick={() => void fetchHistory()} 
          className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-xs font-black text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/10 shadow-xs transition"
        >
          Buscar
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#1E1E1E] p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Desde</label>
              <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-3 py-2 text-xs text-zinc-800 dark:text-white outline-none focus:border-orange-500/50" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Hasta</label>
              <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-3 py-2 text-xs text-zinc-800 dark:text-white outline-none focus:border-orange-500/50" />
            </div>
            <div className="flex-1 flex flex-col min-w-[240px]">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Buscar (#id o nombre)</label>
              <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Ej: 1201 o Juan" className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-3 py-2 text-xs text-zinc-800 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/35 focus:border-orange-500/50" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Filas</label>
              <select value={pageSize} onChange={(e)=>setPageSize(Number(e.target.value))} className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-3 py-2 text-xs text-zinc-800 dark:text-white outline-none focus:border-orange-500/50">
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={150}>150</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        </div>

        {err ? <div className="mt-4 rounded-xl border border-red-800 bg-red-900/10 p-3 text-sm text-red-200">{err}</div> : null}

        {loading ? (
          <div className="mt-4 text-zinc-500 dark:text-gray-300 flex items-center gap-2 text-xs font-bold"><Loader2 className="animate-spin" size={16}/> Cargando historial…</div>
        ) : (
          <div className="mt-4 grid gap-3">
            {rows.length === 0 ? (
              <div className="text-zinc-450 dark:text-gray-400 text-xs italic">Sin resultados registrados.</div>
            ) : rows.map((o:any) => (
              <div key={o.id} className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#1E1E1E] p-4 shadow-sm dark:shadow-md hover:border-emerald-500/50 transition duration-200">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-black text-lg text-zinc-800 dark:text-white">#{o.id} <span className="text-[10px] uppercase font-black text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-black/20 px-2 py-0.5 rounded-md ml-1">{o.payment_method || '—'}</span></div>
                    <div className="text-zinc-700 dark:text-zinc-150 font-bold text-sm mt-0.5">{o.client_name || '—'}</div>
                    <div className="text-[10px] text-zinc-400 dark:text-white/40 mt-1">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-emerald-650 dark:text-emerald-450 font-black text-xl">S/ {Number(o.total||0).toFixed(2)}</div>

                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      <button 
                        onClick={() => void handleOpenEdit(o)} 
                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:text-white shadow-xs transition active:scale-95"
                      >
                        <Pencil size={13} /> Editar
                      </button>
                      <button 
                        onClick={() => void handleReprint(o)} 
                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:text-white shadow-xs transition active:scale-95"
                      >
                        <Printer size={13} /> Reimprimir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditOrderModal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        order={editing}
        onSaved={() => {
          setOpenEdit(false);
          void fetchHistory();
        }}
      />
    </div>
  );
}

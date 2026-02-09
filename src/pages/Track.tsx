import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Search,
  ClipboardCopy,
  ArrowLeft,
  Package,
  Bike,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  StickyNote,
  RefreshCw,
} from 'lucide-react';

function money(n: number) {
  return `S/ ${Number(n || 0).toFixed(2)}`;
}

const MAX_TRACK_HOURS = 72;
function isOlderThanHours(createdAt: string | undefined | null, maxHours: number) {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  const age = (Date.now() - t) / (1000 * 60 * 60);
  return age > maxHours;
}

function fromTrackCode(code: string): number | null {
  const c = (code || '').trim();
  if (!c) return null;
  if (/^\d+$/.test(c)) return Number(c);
  if (/^[0-9a-zA-Z]+$/.test(c)) {
    const n = parseInt(c.toLowerCase(), 36);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isUuid(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test((v||'').trim());
}

function toTrackCode(id: number) {
  return Math.max(0, Number(id) || 0).toString(36).toUpperCase();
}

type StatusTone = 'info' | 'warn' | 'ok' | 'danger';

type StatusMeta = {
  title: string;
  desc: string;
  tone?: StatusTone;
};

const STATUS_META: Record<string, StatusMeta> = {
  // Solicitudes web (order_requests)
  'nuevo': {
    title: 'Solicitud recibida',
    desc: 'Tu pedido fue registrado. En breve lo revisaremos para aprobarlo.',
    tone: 'info',
  },
  'en revisión': {
    title: 'En revisión',
    desc: 'Estamos validando tu pedido. Si falta algo, te contactaremos.',
    tone: 'info',
  },
  'aprobado': {
    title: 'Aprobado',
    desc: 'Tu pedido fue aprobado y pasó a preparación.',
    tone: 'ok',
  },
  'rechazado': {
    title: 'Rechazado',
    desc: 'Tu pedido no pudo ser aprobado. Revisa el motivo y vuelve a intentarlo.',
    tone: 'danger',
  },

  // Pedidos internos (orders)
  'pendiente': {
  title: 'Pendiente de confirmación',
  desc: 'Estamos validando tu pedido. En breve lo confirmaremos o nos comunicaremos contigo si falta algún dato.',
  tone: 'warn',
 },
  'horno': {
    title: 'En horno',
    desc: 'Tu pedido está en cocina y en proceso de horneado/preparación final.',
    tone: 'info',
  },
  // 'listo' y el tramo final se ajustan dinámicamente según tipo (Delivery/Recojo)
  'en camino': {
  title: 'En camino',
  desc: '¡Vamos en camino! Tu pedido ya salió y va rumbo a ti.',
  tone: 'info',
 },
 'en transporte': {
  title: 'En camino',
  desc: '¡Vamos en camino! Tu pedido ya salió y va rumbo a ti.',
    tone: 'info',
  },
  'entregado': {
    title: 'Entregado',
    desc: '¡Gracias! Tu pedido fue entregado.',
    tone: 'ok',
  },
  'recogido': {
    title: 'Recogido',
    desc: '¡Gracias! Tu pedido fue recogido.',
    tone: 'ok',
  },
  'cancelado': {
    title: 'Cancelado',
    desc: 'Este pedido fue cancelado.',
    tone: 'danger',
  },
};

function toneClasses(tone?: StatusTone) {
  switch (tone) {
    case 'ok':
      return 'bg-green-500/15 border-green-500/40 text-green-300';
    case 'danger':
      return 'bg-red-500/15 border-red-500/40 text-red-300';
    case 'warn':
      return 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300';
    default:
      return 'bg-white/5 border-white/10 text-white/80';
  }
}

function normalizeStatus(s: any) {
  return String(s || '').trim().toLowerCase();
}

function buildSteps(serviceType?: string) {
  const isDelivery = String(serviceType ?? '').toLowerCase() === 'delivery';
  return isDelivery
    ? ['Registrado', 'En horno', 'Listo', 'Empaque final', 'En camino', 'Entregado']
    : ['Registrado', 'En horno', 'Listo', 'Empaque final', 'Recogido'];
}

function stepIndexFor(status: string, serviceType?: string) {
  const s = normalizeStatus(status);
  const isDelivery = String(serviceType ?? '').toLowerCase() === 'delivery';
  // Estados de solicitud: se consideran como 'Registrado'
  if (s === 'nuevo' || s === 'en revisión' || s === 'aprobado') return 0;
  if (s === 'pendiente') return 0;
  if (s === 'horno') return 1;
  if (s === 'listo') return 2;
  if (s === 'en empaquetado' || s === 'empaque final') return 3;
  if (s === 'en transporte' || s === 'en camino') return isDelivery ? 4 : 3;
  if (s === 'entregado') return isDelivery ? 5 : 4;
  if (s === 'recogido') return 4;
  return 0;
}

function estimateStepMinutes(totalMinutes: number | string | null | undefined, steps: string[]) {
  const total = Number(totalMinutes ?? 0);
  if (!Number.isFinite(total) || total <= 0) return steps.map(() => null as number | null);
  const isDelivery = steps.includes('En camino');
  const weights = isDelivery
    ? [0.05, 0.55, 0.10, 0.10, 0.20, 0]
    : [0.05, 0.65, 0.10, 0.20, 0];
  const mins = steps.map((_, i) => {
    const w = weights[i] ?? 0;
    const v = Math.max(0, Math.round(total * w));
    return i === steps.length - 1 ? 0 : v;
  });
  const lastIdx = Math.max(0, steps.length - 2);
  const sum = mins.slice(0, steps.length - 1).reduce((a, b) => a + (b ?? 0), 0);
  const diff = sum - total;
  if (diff > 0) mins[lastIdx] = Math.max(0, (mins[lastIdx] ?? 0) - diff);
  return mins.map((m, i) => (i === steps.length - 1 ? null : m));
}

export default function Track() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastTone, setToastTone] = useState<'info' | 'warn' | 'ok' | 'danger'>('info');
  const [showToast, setShowToast] = useState(false);
  const lastStatusRef = useRef<string>('');
  const inFlightRef = useRef(false);
  const lastFetchRef = useRef(0);
  const subscribedRef = useRef(false);
  const [request, setRequest] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);

  const effective = (token || '').trim();
  const numericId = useMemo(() => fromTrackCode(effective), [effective]);

  const showToastSafe = (msg: string, tone: 'info' | 'warn' | 'ok' | 'danger' = 'info') => {
  setToastMsg(msg);
  setToastTone(tone);
  setShowToast(true);
  window.setTimeout(() => setShowToast(false), 2500);
};

const copy = async (text: string) => {
  try {

// 0) Intentar lookup seguro por RPC (si existe)
try {
  const p_public_token = isUuid(effective) ? effective : null;
  const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_track_lookup', {
    p_request_id: numericId !== null ? numericId : null,
    p_public_token: p_public_token,
  });
  if (!rpcErr && rpcData?.ok && rpcData.request) {
    setRequest(rpcData.request);
    if (rpcData.order) setOrder(rpcData.order);
    return;
  }
} catch {
  // si no existe la RPC o falla, seguimos con selects directos
}

    await navigator.clipboard.writeText(text);
    showToastSafe('Código copiado', 'ok');
  } catch {
    // ignore
  }
};

  
const load = async (opts?: { silent?: boolean }) => {
  const silent = opts?.silent ?? false;
  if (!effective) return;

  const now = Date.now();
  const minGap = silent ? 1200 : 400;
  if (now - lastFetchRef.current < minGap) return;
  lastFetchRef.current = now;

  if (inFlightRef.current) return;
  inFlightRef.current = true;

  const shouldShowLoading = !silent && !request && !order;
  if (shouldShowLoading) setLoading(true);
  if (!silent) setError(null);

  try {      // 1) Track estable: id de order_requests
      if (numericId !== null) {
        const { data: r, error: e1 } = await supabase.from('order_requests').select('*').eq('id', numericId).single();
        if (!e1 && r) {
          // No mostrar tracking de solicitudes con más de 72 horas
          if (isOlderThanHours((r as any).created_at, MAX_TRACK_HOURS)) {
            setRequest(null);
            setOrder(null);
            setError('Seguimiento ya no está disponible (máximo 72 horas).');
            return;
          }
          setRequest(r);
          const mapped = (r as any).mapped_order_id;
          if (mapped) {
            const { data: o } = await supabase.from('orders').select('*').eq('id', mapped).single();
            if (o) setOrder(o);
          }
          return;
        }
      }

      // 3) compat token UUID
      const { data: r2, error: e3 } = await supabase.from('order_requests').select('*').eq('public_token', effective).single();
      if (!e3 && r2) {
        // No mostrar tracking de solicitudes con más de 72 horas
        if (isOlderThanHours((r2 as any).created_at, MAX_TRACK_HOURS)) {
          setRequest(null);
          setOrder(null);
          setError('Seguimiento ya no está disponible (máximo 72 horas).');
          return;
        }
        setRequest(r2);
        const mapped = (r2 as any).mapped_order_id;
        if (mapped) {
          const { data: o } = await supabase.from('orders').select('*').eq('id', mapped).single();
          if (o) setOrder(o);
        }
        return;
      }

      setError('No encontramos ese código. Revisa e intenta nuevamente.');
    } catch {
      setError('Error al consultar seguimiento.');
    } finally {
      if (shouldShowLoading) setLoading(false);
      inFlightRef.current = false;
    }
  };

  // Carga inicial al abrir un link /track/:token
useEffect(() => {
  subscribedRef.current = false;
  setAutoUpdating(false);
  setError(null);
  setRequest(null);
  setOrder(null);
  if (token) load({ silent: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [token]);

  // Suscripción en tiempo real para actualizar automáticamente (y fallback por polling)
useEffect(() => {
  const reqId = request?.id ? Number(request.id) : null;
  const ordId = order?.id ? Number(order.id) : null;

  if (!reqId && !ordId) return;

  let poll: any = null;
  const startPolling = () => {
    if (poll) return;
    poll = window.setInterval(() => load({ silent: true }), 7000);
  };

  const channels: any[] = [];

  const onStatus = (status: string) => {
    if (status === 'SUBSCRIBED') {
      subscribedRef.current = true;
      setAutoUpdating(true);
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      subscribedRef.current = false;
      setAutoUpdating(false);
      startPolling();
    }
  };

  const watchdog = window.setTimeout(() => {
    if (!subscribedRef.current) startPolling();
  }, 3000);

  if (reqId) {
    const chReq = supabase
      .channel(`track_req_${reqId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests', filter: `id=eq.${reqId}` }, () => load({ silent: true }))
      .subscribe(onStatus);
    channels.push(chReq);
  }

  if (ordId) {
    const chOrd = supabase
      .channel(`track_order_${ordId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${ordId}` }, () => load({ silent: true }))
      .subscribe(onStatus);
    channels.push(chOrd);
  }

  load({ silent: true });

  return () => {
    window.clearTimeout(watchdog);
    if (poll) clearInterval(poll);
    setAutoUpdating(false);
    channels.forEach((c) => {
      try { supabase.removeChannel(c); } catch {}
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [request?.id, order?.id, token]);

  const requestId = request?.id ? Number(request.id) : null;
  const orderId = order?.id ? Number(order.id) : null;
  const stableId = requestId ?? orderId;
  const trackCode = stableId !== null ? toTrackCode(stableId) : '';

  const status = order?.status || request?.status || '';
  const serviceType = order?.service_type || request?.service_type || '';

  // Meta dinámica para "Listo": aclara que salió del horno y qué sigue
  const norm = normalizeStatus(status);
  const isDelivery = String(serviceType).toLowerCase() === 'delivery';
  useEffect(() => {
    if (!norm) return;
    if (lastStatusRef.current && lastStatusRef.current !== norm) {
      if (norm === 'pendiente') showToastSafe('Pedido pendiente de confirmación', 'warn');
    }
    lastStatusRef.current = norm;
  }, [norm]);

  const listoMeta: StatusMeta = {
  title: 'Listo',
  desc: isDelivery
    ? 'Tu pedido salió del horno. Ahora pasa al empaque final y reparto.'
    : 'Tu pedido salió del horno. Ahora pasa al empaque final para recojo.',
  tone: 'ok',
};
const empaqueFinalMeta: StatusMeta = {
  title: 'Empaque final',
  desc: isDelivery
    ? 'Empaque final en curso. En breve pasará a “En camino”.'
    : 'Empaque final en curso. Ya casi está listo para recojo.',
  tone: 'info',
};
const meta = (norm === 'listo')
  ? listoMeta
  : (norm === 'en empaquetado' || norm === 'empaque final')
    ? empaqueFinalMeta
    : (STATUS_META[norm] ?? { title: 'Estado actualizado', desc: 'Tu pedido está en proceso. Si necesitas ayuda, contáctanos.', tone: 'info' as const });

  const steps = buildSteps(serviceType);
  const stepMins = estimateStepMinutes(order?.estimated_minutes ?? request?.estimated_minutes, steps);
  const stepIdx = stepIndexFor(status, serviceType);
  const clampedIdx = Math.max(0, Math.min(stepIdx, steps.length - 1));
  const progressPct = Math.round(((clampedIdx + 1) / steps.length) * 100);

  const items: any[] = (order?.items || request?.items || []) as any[];
  const delivery = Number(order?.delivery_cost ?? request?.delivery_fee ?? 0);
  const total = Number(order?.total ?? request?.estimated_total ?? 0);
  const subtotal = Math.max(0, total - (isDelivery ? delivery : 0));

  const clientName = order?.client_name || request?.customer_name || '';
  const phone = order?.client_phone || request?.phone || '';
  const address = order?.client_address || request?.address || '';
  const notes = order?.notes || request?.notes || '';

  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">
      <header className="sticky top-0 z-10 bg-[#0f0f10]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-2xl mx-auto p-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 flex items-center gap-2" type="button">
            <ArrowLeft size={18}/> Volver
          </button>
          <Link to="/pedido" className="text-sm text-white/70 hover:text-white">Hacer pedido</Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {/* Región accesible para mensajes no intrusivos */}
        <div aria-live="polite" className="sr-only" role="status">{showToast ? toastMsg : ''}</div>
        {/* Toast visual minimalista */}
        {showToast && (
          <div className={"fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl border border-white/10 shadow-lg text-sm z-50 \n            " + (toastTone === 'ok' ? 'bg-green-700/80' : toastTone === 'warn' ? 'bg-yellow-700/80' : toastTone === 'danger' ? 'bg-red-700/80' : 'bg-black/80') + " text-white"} role="status" aria-live="polite">
            {toastMsg}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-black">Seguimiento de Pedido</h1>
          {autoUpdating && (
            <div className="text-xs text-white/60 flex items-center gap-2"><RefreshCw size={14}/> Actualización automática</div>
          )}
        </div>

        {/* Buscador */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-3">
          <label htmlFor="track-code" className="text-xs text-white/60 font-semibold" id="track-help">Ingresa tu código (ej: 9IX)</label>
          <div className="flex gap-2 mt-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
              placeholder="Ej: 9IX"
              className="flex-1 bg-transparent border border-white/10 rounded-xl px-3 py-2 outline-none"
            />
            <button
              type="button"
              onClick={() => {
              const v = codeInput.trim();
              if (!v) {
                showToastSafe('Ingresa un código de seguimiento', 'warn');
                return;
              }
              navigate(`/track/${v}`);
            }}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 font-bold flex items-center gap-2"
            >
              <Search size={16}/> Buscar
            </button>
          </div>
        </div>

        {loading && <div className="mt-4 text-orange-400 animate-pulse" role="status" aria-busy="true">Cargando...</div>}
        {error && <div className="mt-4 text-red-400" role="alert">{error}</div>}

        {(order || request) && (
          <div className="mt-4 space-y-3">
            {/* Resumen */}
            <div className={`border rounded-2xl p-4 ${toneClasses(meta.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-white/70">Código de seguimiento</div>
                  <div className="text-2xl font-black tracking-wider">{trackCode}</div>
                </div>
                <button onClick={() => copy(trackCode)} className="px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 flex items-center gap-2 text-sm" type="button">
                  <ClipboardCopy size={16}/> Copiar
                </button>
              </div>

              <div className="mt-3">
                <div className="font-black text-lg whitespace-normal break-words max-w-full leading-snug">{meta.title}</div>
                <div className="text-sm text-white/80 mt-1">{meta.desc}</div>
              {norm === 'pendiente' && (
  <div className="mt-3 border rounded-xl p-3 bg-yellow-500/10 border-yellow-500/30 text-yellow-200 text-sm">
    <b>Pendiente de confirmación:</b> Estamos validando tu pedido. En breve lo confirmaremos o te contactaremos si falta algún dato.
  </div>
)}{/* PENDIENTE_ALERT */}
              </div>

              {/* Progreso */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-white/70">
                  {steps.map((s, idx) => (
            <span key={s} className={idx <= stepIdx ? 'text-white' : ''}>
              {s}
              {stepMins?.[idx] != null && (
                <span className="block text-[10px] text-white/50">≈ {stepMins[idx]} min</span>
              )}
            </span>
          ))}
                </div>
                <div className="mt-2 h-2 rounded-full bg-black/20 overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    role="progressbar" aria-label="Progreso del pedido" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPct} style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* IDs */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {requestId !== null && (
                  <div className="flex items-center gap-2"><Package size={16}/> Solicitud (ID): <span className="font-semibold">{requestId}</span></div>
                )}
                {orderId !== null && (
                  <div className="flex items-center gap-2"><Bike size={16}/> Pedido (ID): <span className="font-semibold">{orderId}</span></div>
                )}
              </div>
            </div>

            {/* Datos */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="font-bold mb-2 flex items-center gap-2"><CheckCircle2 size={18}/> Datos del pedido</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/80">
                <div><span className="text-white/60">Cliente:</span> {clientName || '—'}</div>
                <div className="flex items-center gap-2"><Phone size={16}/> <span className="text-white/60">Tel:</span> {phone || '—'}</div>
                <div><span className="text-white/60">Tipo:</span> {serviceType || '—'}</div>
                <div className="flex items-center gap-2"><Clock size={16}/> <span className="text-white/60">Tiempo estimado:</span> {order?.estimated_minutes || request?.estimated_minutes || '—'} min</div>
                {isDelivery && (
                  <div className="sm:col-span-2 flex items-start gap-2"><MapPin size={16} className="mt-0.5"/> <span><span className="text-white/60">Dirección:</span> {address || '—'}</span></div>
                )}
                {notes && (
                  <div className="sm:col-span-2 flex items-start gap-2"><StickyNote size={16} className="mt-0.5"/> <span><span className="text-white/60">Notas:</span> {notes}</span></div>
                )}
              </div>
            </div>

            {/* Detalle */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="font-bold mb-2">Detalle del pedido</div>
              {items.length === 0 ? (
                <div className="text-white/60 text-sm">Sin detalle disponible.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {items.map((i: any) => (
                    <div key={i.id || i.name} className="flex justify-between border-b border-white/10 pb-2 whitespace-normal break-words max-w-full leading-snug">
                      <span className="text-white/90 whitespace-normal break-words max-w-full leading-snug">{i.qty} x {i.name}</span>
                      <span className="text-white/80">{money(Number(i.price) * Number(i.qty))}

</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ✅ Concepto de envío (solo Delivery) */}
              {isDelivery && (
                <div className="flex justify-between border-b border-white/10 pb-2 text-sm">
                  <span className="text-white/90">Concepto: Envío</span>
                  <span className="text-white/80">{money(delivery)}</span>
                </div>
              )}

              <div className="mt-4 bg-black/20 rounded-2xl p-4">
                <div className="flex justify-between text-sm text-white/80"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                {isDelivery && (
                  <div className="flex justify-between text-sm text-white/80 mt-1"><span>Costo de envío</span><span>{money(delivery)}</span></div>
                )}
                <div className="flex justify-between font-black text-lg mt-2"><span>Total</span><span className="text-orange-400">{money(total)}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
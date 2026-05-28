import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { refreshConfigCache } from '../lib/configCache';

const PRIMARY_KEY = 'costo_delivery';
const FALLBACK_KEY = 'delivery_fee';

function pickNumber(row: any): number | null {
  if (!row) return null;
  const v = row.numeric_value ?? row.text_value;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function AdminPedidoEnvio() {
  const [deliveryFee, setDeliveryFee] = useState<number>(2);
  const [freeDelivery, setFreeDelivery] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const effectiveFee = freeDelivery ? 0 : deliveryFee;

  const formatted = useMemo(() => `S/ ${Number(effectiveFee).toFixed(2)}`, [effectiveFee]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);

      try {
        const { data, error } = await supabase
          .from('config')
          .select('key, numeric_value, text_value')
          .in('key', [PRIMARY_KEY, FALLBACK_KEY]);

        if (error) throw error;

        const primary = (data || []).find((r: any) => r.key === PRIMARY_KEY);
        const fallback = (data || []).find((r: any) => r.key === FALLBACK_KEY);
        const v = pickNumber(primary) ?? pickNumber(fallback) ?? 2;

        if (alive) {
          setDeliveryFee(v);
          setFreeDelivery(Number(v) === 0);
        }
      } catch (e: any) {
        if (alive) setErr(e?.message ?? 'No se pudo cargar el costo de envío');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const v = Number(effectiveFee);
      if (!Number.isFinite(v) || v < 0) throw new Error('El costo debe ser un número válido (>= 0).');

      // ✅ quirúrgico: guardar en ambas keys (por compatibilidad)
      const { error } = await supabase
        .from('config')
        .upsert([
          { key: PRIMARY_KEY, numeric_value: v },
          { key: FALLBACK_KEY, numeric_value: v },
        ], { onConflict: 'key' });

      if (error) throw error;

      try { await refreshConfigCache(); } catch {}

      setMsg(`Listo ✅ Envío para /pedido: ${formatted}`);
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black">Envío (solo /pedido)</h2>
        <p className="text-sm text-white/70">Valor global para todos los pedidos hechos desde <b>/pedido</b>.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold">Costo actual</div>
            <div className="text-xs text-white/60">Se guarda en config.{PRIMARY_KEY} y config.{FALLBACK_KEY}</div>
          </div>
          <div className="text-sm font-black text-orange-300">{loading ? 'Cargando…' : formatted}</div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div>
            <div className="text-sm font-bold">Delivery gratis</div>
            <div className="text-[11px] text-white/60">Si lo activas, el envío queda en S/ 0.00</div>
          </div>
          <button
            type="button"
            onClick={() => setFreeDelivery(v => !v)}
            disabled={loading || saving}
            className={`h-9 w-16 rounded-full border transition ${freeDelivery ? 'bg-emerald-600 border-emerald-500' : 'bg-gray-700 border-white/10'}`}
            aria-label="Toggle delivery gratis"
          >
            <div className={`h-8 w-8 rounded-full bg-white transition-transform ${freeDelivery ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-white/70">Nuevo costo (S/)</label>
          <input
            type="number"
            step="0.10"
            min="0"
            disabled={loading || saving || freeDelivery}
            value={Number.isFinite(deliveryFee) ? deliveryFee : 0}
            onChange={(e) => setDeliveryFee(Number(e.target.value))}
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-orange-500 disabled:opacity-50"
          />
          <div className="text-[11px] text-white/50">Recomendación: usa decimales (ej. 2.00, 3.50).</div>
        </div>

        <button type="button" onClick={save} disabled={loading || saving} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black hover:bg-emerald-700 disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>

        {msg && <div className="text-sm text-emerald-300">{msg}</div>}
        {err && <div className="text-sm text-rose-300">{err}</div>}
      </div>
    </div>
  );
}

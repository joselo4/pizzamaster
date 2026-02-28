import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { refreshConfigCache } from '../lib/configCache';
import AdminPedidoEnvio from './AdminPedidoEnvio';

const KEY_EST_MIN_1 = 'tiempo_estimado_min';
const KEY_EST_MIN_2 = 'estimated_minutes';
const KEY_NOTICE_ENABLED = 'customer_notice_enabled';
const KEY_NOTICE_TEXT = 'customer_notice_text';

// /pedido: categoría inicial
const KEY_PEDIDO_DEFAULT_CATEGORY = 'pedido_default_category';

// /pedido: ventana de atención
const KEY_PEDIDO_ENABLED = 'pedido_enabled';
const KEY_PEDIDO_DISABLED_MSG = 'pedido_disabled_message';

// Contacto global (un solo lugar)
const KEY_STORE_PHONE = 'telefono_tienda';
const KEY_PROMO_PHONE = 'promo_phone';
const KEY_WA_1 = 'promo_wa_number';
const KEY_WA_2 = 'wa_number';

function pickNumberFromConfig(map: Record<string, any>, ...keys: string[]) {
  for (const k of keys) {
    const n = Number(map?.[k]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export default function AdminPedidoSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(40);
  const [noticeEnabled, setNoticeEnabled] = useState<boolean>(false);
  const [noticeText, setNoticeText] = useState<string>('');

  const [storeName, setStoreName] = useState<string>('');
  const [storeLogo, setStoreLogo] = useState<string>('');
  const [storePhone, setStorePhone] = useState<string>('');
  const [storeAddress, setStoreAddress] = useState<string>('');
  const [ticketFooter, setTicketFooter] = useState<string>('');
  const [pedidoDefaultCategory, setPedidoDefaultCategory] = useState<string>('Pizzas');

  const [pedidoEnabled, setPedidoEnabled] = useState<boolean>(true);
  const [pedidoDisabledMessage, setPedidoDisabledMessage] = useState<string>('');
  const [storeWa, setStoreWa] = useState<string>('');

  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState('');

  const filteredProducts = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(p => String(p.name || '').toLowerCase().includes(s));
  }, [products, q]);

  const load = async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const { data: cfgData, error: cfgErr } = await supabase.from('config').select('*');
      if (cfgErr) throw cfgErr;
      const map: Record<string, any> = {};
      (cfgData || []).forEach((r: any) => {
        map[r.key] = r.text_value ?? r.numeric_value ?? r.num_value ?? r.number_value ?? r.value;
      });

      const est = pickNumberFromConfig(map, KEY_EST_MIN_1, KEY_EST_MIN_2) ?? 40;
      setEstimatedMinutes(est);

      const enabled = String(map?.[KEY_NOTICE_ENABLED] ?? 'false') === 'true';
      setNoticeEnabled(enabled);
      setNoticeText(String(map?.[KEY_NOTICE_TEXT] ?? ''));

      setStoreName(String(map?.nombre_tienda ?? ''));
      setStoreLogo(String(map?.logo_url ?? ''));
      setStorePhone(String(map?.telefono_tienda ?? ''));
      setStoreAddress(String(map?.direccion_tienda ?? ''));
      setTicketFooter(String(map?.footer_ticket ?? ''));

      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, category, active, sort_index, is_promo')
        .order('sort_index', { ascending: true });
      if (prodErr) throw prodErr;
      setProducts(prodData || []);
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAjustes = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const est = Number(estimatedMinutes);
      if (!Number.isFinite(est) || est < 1) throw new Error('Tiempo estimado inválido');

      const updates = [
        // ✅ quirúrgico: tiempo en ambas keys
        { key: KEY_EST_MIN_1, numeric_value: est },
        { key: KEY_EST_MIN_2, numeric_value: est },
        { key: KEY_NOTICE_ENABLED, text_value: noticeEnabled ? 'true' : 'false' },
        { key: KEY_NOTICE_TEXT, text_value: noticeText || '' },
        { key: 'nombre_tienda', text_value: storeName || '' },
        { key: 'logo_url', text_value: storeLogo || '' },
        { key: 'telefono_tienda', text_value: storePhone || '' },
        { key: 'direccion_tienda', text_value: storeAddress || '' },
        { key: 'footer_ticket', text_value: ticketFooter || '' },
        { key: KEY_PEDIDO_DEFAULT_CATEGORY, text_value: pedidoDefaultCategory || 'Pizzas' },
        { key: KEY_PEDIDO_ENABLED, text_value: pedidoEnabled ? 'true' : 'false' },
        { key: KEY_PEDIDO_DISABLED_MSG, text_value: pedidoDisabledMessage || '' },
        { key: KEY_STORE_PHONE, text_value: storePhone || '' },
        { key: KEY_PROMO_PHONE, text_value: storePhone || '' },
        { key: KEY_WA_1, text_value: storeWa || '' },
        { key: KEY_WA_2, text_value: storeWa || '' },
      ];

      const dedupedUpdates = Array.from(new Map(updates.map((u: any) => [u.key, u])).values());

      const { error } = await supabase.from('config').upsert(dedupedUpdates, { onConflict: 'key' });
      if (error) throw error;

      try { await refreshConfigCache(); } catch {}

      setMsg('✅ Ajustes guardados');
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const updateProdLocal = (id: any, patch: any) => {
    setProducts(prev => prev.map(p => (String(p.id) === String(id) ? { ...p, ...patch } : p)));
  };

  const saveProductRow = async (p: any) => {
    try {
      const price = Number(p.price);
      if (!Number.isFinite(price) || price < 0) throw new Error('Precio inválido');

      const { error } = await supabase
        .from('products')
        .update({ price, is_promo: !!p.is_promo, category: p.category || 'Pizzas' })
        .eq('id', p.id);

      if (error) throw error;
      setMsg(`✅ Guardado: ${p.name}`);
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo guardar producto');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black">Ajustes rápidos</h2>
          <div className="text-sm text-white/60">Cambios rápidos para /pedido y pantallas públicas</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={loading || saving} className="px-4 py-2 rounded-xl bg-gray-800 text-white font-bold hover:bg-gray-700 disabled:opacity-50">{loading ? 'Cargando…' : 'Recargar'}</button>
          <button type="button" onClick={saveAjustes} disabled={loading || saving} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-500 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar ajustes'}</button>
        </div>
      </div>

      {err && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-100 p-3 rounded-xl text-sm">{err}</div>}
      {msg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 p-3 rounded-xl text-sm">{msg}</div>}

      <div className="bg-card border border-white/10 rounded-2xl p-4">
        <AdminPedidoEnvio />

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-lg font-black">Atención / Pedidos</div>
          <div className="mt-1 text-sm text-white/70">Si desactivas pedidos, /pedido mostrará pantalla completa y bloqueará el envío.</div>

          <div className="mt-4 flex items-center gap-3">
            <input id="pedido_enabled" name="pedido_enabled" type="checkbox" checked={pedidoEnabled} onChange={(e) => setPedidoEnabled(e.target.checked)} />
            <label htmlFor="pedido_enabled" className="text-sm font-bold">Pedidos habilitados</label>
          </div>

          {!pedidoEnabled && (
            <div className="mt-4">
              <label htmlFor="pedido_disabled_message" className="text-sm font-bold">Mensaje (aviso personalizado)</label>
              <textarea id="pedido_disabled_message" name="pedido_disabled_message" value={pedidoDisabledMessage} onChange={(e) => setPedidoDisabledMessage(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm" rows={3} placeholder="Ej: Hoy no atendemos. Volvemos mañana 6pm." />
            </div>
          )}
        

          <div className="mt-4">
            <button type="button" onClick={saveAjustes} disabled={loading || saving} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-500 disabled:opacity-50">Guardar Atención/Pedidos</button>
          </div>
</div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-lg font-black">Botones globales (Llamar / WhatsApp)</div>
          <div className="mt-1 text-sm text-white/70">Configura una sola vez y se usará en /pedido (cerrado) y botones públicos.</div>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="global_phone" className="text-sm font-bold">Teléfono (Llamar)</label>
              <input id="global_phone" name="global_phone" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="+519XXXXXXXX" />
              <div className="mt-2 text-xs text-white/60">Se guardará en telefono_tienda y promo_phone.</div>
            </div>
            <div>
              <label htmlFor="global_wa" className="text-sm font-bold">WhatsApp (número)</label>
              <input id="global_wa" name="global_wa" value={storeWa} onChange={(e) => setStoreWa(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="519XXXXXXXX" />
              <div className="mt-2 text-xs text-white/60">Se guardará en promo_wa_number y wa_number.</div>
            </div>
          </div>

          <div className="mt-4">
            <button type="button" onClick={saveAjustes} disabled={loading || saving} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-500 disabled:opacity-50">Guardar botones</button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="font-extrabold">/pedido: categoría inicial</div>
          <div className="mt-3 grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-bold">Categoría inicial en /pedido</div>
              <select className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2" value={pedidoDefaultCategory} onChange={(e) => setPedidoDefaultCategory(e.target.value)} >
                <option value="Pizzas">Pizzas</option>
                <option value="Promo">Promo</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Extras">Extras</option>
                <option value="Todos">Todos</option>
              </select>
              <div className="mt-3">
                <button type="button" onClick={saveAjustes} disabled={loading || saving} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-500 disabled:opacity-50">Guardar categoría inicial</button>
              </div>
              <div className="text-[11px] text-white/60 mt-1">config.{KEY_PEDIDO_DEFAULT_CATEGORY}</div>
            </div>
            <div className="text-sm text-white/60">Se aplica al abrir /pedido.</div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-white/10 rounded-2xl p-4 space-y-4">
        <h3 className="text-xl font-black">Datos que se muestran en /pedido</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm">
            <div className="font-bold mb-1">Tiempo estimado (min)</div>
            <input type="number" min={1} className="w-full bg-dark p-3 rounded border border-gray-600" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value))} />
            <div className="text-[11px] text-white/60 mt-1">config.{KEY_EST_MIN_1} y config.{KEY_EST_MIN_2}</div>
          </label>
          <div className="text-sm">
            <div className="font-bold mb-1">Aviso al cliente</div>
            <button type="button" onClick={() => setNoticeEnabled(v => !v)} className={`w-full px-4 py-3 rounded-xl font-extrabold ${noticeEnabled ? 'bg-emerald-600' : 'bg-gray-700'}`}>{noticeEnabled ? 'ACTIVADO' : 'DESACTIVADO'}</button>
            <div className="text-[11px] text-white/60 mt-1">config.{KEY_NOTICE_ENABLED}</div>
          </div>
        </div>
        <label className="text-sm block">
          <div className="font-bold mb-1">Texto del aviso</div>
          <textarea className="w-full bg-dark p-3 rounded border border-gray-600 min-h-[96px]" value={noticeText} onChange={(e) => setNoticeText(e.target.value)} placeholder="Ej: Por favor confirma tu dirección y referencia." />
          <div className="text-[11px] text-white/60 mt-1">config.{KEY_NOTICE_TEXT}</div>
        </label>
      </div>

      <div className="bg-card border border-white/10 rounded-2xl p-4 space-y-4">
        <h3 className="text-xl font-black">Identidad y Ticket</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm">
            <div className="font-bold mb-1">Nombre de la tienda</div>
            <input className="w-full bg-dark p-3 rounded border border-gray-600" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Ej: Pizzería Don Carlos" />
            <div className="text-[11px] text-white/60 mt-1">config.nombre_tienda</div>
          </label>
          <label className="text-sm">
            <div className="font-bold mb-1">Logo URL (o Base64)</div>
            <input className="w-full bg-dark p-3 rounded border border-gray-600" value={storeLogo} onChange={(e) => setStoreLogo(e.target.value)} placeholder="https://... o data:image/..." />
            <div className="text-[11px] text-white/60 mt-1">config.logo_url</div>
          </label>
          <label className="text-sm">
            <div className="font-bold mb-1">Teléfono</div>
            <input className="w-full bg-dark p-3 rounded border border-gray-600" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="999999999" />
            <div className="text-[11px] text-white/60 mt-1">config.telefono_tienda</div>
          </label>
          <label className="text-sm">
            <div className="font-bold mb-1">Dirección</div>
            <input className="w-full bg-dark p-3 rounded border border-gray-600" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Av. ..." />
            <div className="text-[11px] text-white/60 mt-1">config.direccion_tienda</div>
          </label>
        </div>
        <label className="text-sm block">
          <div className="font-bold mb-1">Footer del ticket</div>
          <textarea className="w-full bg-dark p-3 rounded border border-gray-600 min-h-[80px]" value={ticketFooter} onChange={(e) => setTicketFooter(e.target.value)} placeholder="Gracias por tu compra..." />
          <div className="text-[11px] text-white/60 mt-1">config.footer_ticket</div>
        </label>
      </div>

      <div className="bg-card border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-xl font-black">Precios de productos (para /pedido)</h3>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" className="bg-dark border border-gray-700 rounded-xl px-3 py-2 text-sm" />
        </div>

        <div className="space-y-2">
          {filteredProducts.map((p) => (
            <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold whitespace-normal break-words">{p.name}</div>
                <div className="text-[11px] text-white/60">{p.category || '—'}{p.is_promo ? ' • Promo' : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">S/</span>
                <input type="number" step="0.10" min="0" className="w-28 bg-dark border border-gray-700 rounded-lg px-2 py-2 text-sm" value={p.price ?? 0} onChange={(e) => updateProdLocal(p.id, { price: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm select-none">
                <input type="checkbox" checked={!!p.is_promo} onChange={(e) => updateProdLocal(p.id, { is_promo: e.target.checked })} />
                <span>Promo</span>
              </label>
              <button type="button" onClick={() => saveProductRow({ ...p, price: Number(p.price) })} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">Guardar</button>
            </div>
          ))}
          {!filteredProducts.length && (<div className="text-sm text-white/60">No hay productos para mostrar.</div>)}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { refreshConfigCache } from '../lib/configCache';
import { listAllPromotionsStaff, type Promotion } from '../lib/promos';

const KEY_TODAY_TITLE = 'promo_today_title';
const KEY_TODAY_IMAGE = 'promo_today_image_url';
const KEY_FEATURED_SLUG = 'promo_featured_slug';

function rowsToMap(rows: any[]): Record<string, any> {
  const c: any = {};
  (rows || []).forEach((r: any) => {
    c[r.key] = (r.text_value ?? r.numeric_value ?? r.num_value ?? r.number_value ?? r.value);
  });
  return c;
}

export default function AdminPromoToday() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [todayTitle, setTodayTitle] = useState('Tu promo de hoy');
  const [todayImageUrl, setTodayImageUrl] = useState('');
  const [featuredSlug, setFeaturedSlug] = useState('');

  const featuredPromo = useMemo(() => {
    if (!promos?.length) return null;
    const slug = String(featuredSlug || '').trim();
    return promos.find((p) => String(p.slug) === slug) || promos[0];
  }, [promos, featuredSlug]);

  const previewImg = useMemo(() => {
    const o = String(todayImageUrl || '').trim();
    if (o) return o;
    return String(featuredPromo?.image_url || featuredPromo?.thumb_url || '');
  }, [todayImageUrl, featuredPromo]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);
      try {
        const list = await listAllPromotionsStaff();
        setPromos(list || []);

        const { data, error } = await supabase.from('config').select('*');
        if (error) throw error;
        const c = rowsToMap(data || []);

        setTodayTitle(String(c[KEY_TODAY_TITLE] || 'Tu promo de hoy'));
        setTodayImageUrl(String(c[KEY_TODAY_IMAGE] || ''));
        setFeaturedSlug(String(c[KEY_FEATURED_SLUG] || ''));
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const usePromoImage = () => {
    const u = String(featuredPromo?.image_url || featuredPromo?.thumb_url || '');
    if (u) setTodayImageUrl(u);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const updates = [
        { key: KEY_TODAY_TITLE, text_value: String(todayTitle || '') },
        { key: KEY_TODAY_IMAGE, text_value: String(todayImageUrl || '') },
        { key: KEY_FEATURED_SLUG, text_value: String(featuredSlug || '') },
      ];
      const { error } = await supabase.from('config').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      await refreshConfigCache().catch(() => {});
      setMsg('✅ Guardado. Se verá en /promo y /promos.');
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 pb-10 text-white">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xl font-black">Promo de hoy</div>
        <div className="mt-1 text-sm text-white/70">Selecciona la promo destacada y ajusta título/imagen. Incluye vista previa.</div>
      </div>

      {loading && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Cargando…</div>}
      {!loading && err && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200"><b>Error:</b> {err}</div>}
      {msg && <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 font-bold">{msg}</div>}

      {!loading && (
        <div className="mt-4 grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label htmlFor="promo_today_title" className="text-sm font-bold">Título</label>
            <input id="promo_today_title" name="promo_today_title" value={todayTitle} onChange={(e) => setTodayTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="promo_featured_slug" className="text-sm font-bold">Promo destacada</label>
                <select id="promo_featured_slug" name="promo_featured_slug" value={featuredSlug} onChange={(e) => setFeaturedSlug(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                  <option value="">(Auto: primera activa)</option>
                  {promos.map((p) => (<option key={p.id} value={p.slug}>{p.name} ({p.slug})</option>))}
                </select>
              </div>

              <div>
                <label htmlFor="promo_today_image_url" className="text-sm font-bold">Imagen (URL)</label>
                <input id="promo_today_image_url" name="promo_today_image_url" value={todayImageUrl} onChange={(e) => setTodayImageUrl(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="https://..." />
                <div className="mt-2">
                  <button type="button" onClick={usePromoImage} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15">Usar imagen de la promo</button>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-orange-600 px-4 py-2 font-black hover:bg-orange-500 disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-bold">Vista previa</div>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <img src={previewImg || '/promos/promo_placeholder_1.svg'} alt="preview" className="h-48 w-full object-cover" />
              </div>
              <div>
                <div className="text-lg font-black">{todayTitle}</div>
                <div className="mt-1 text-white/70 text-sm">{featuredPromo?.detail_text || featuredPromo?.headline || 'Selecciona una promo'}</div>
                <div className="mt-2 text-2xl font-black text-emerald-300">{featuredPromo?.price_text || ''}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

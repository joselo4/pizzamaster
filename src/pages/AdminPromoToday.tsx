import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { refreshConfigCache } from '../lib/configCache';
import { listAllPromotionsStaff, type Promotion } from '../lib/promos';

const PROMO_IMAGE_FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#27272a"/>
      <stop offset="0.55" stop-color="#18181b"/>
      <stop offset="1" stop-color="#431407"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1200" rx="42" fill="url(#g)"/>
  <circle cx="710" cy="170" r="190" fill="#f97316" opacity="0.18"/>
  <circle cx="190" cy="990" r="220" fill="#10b981" opacity="0.12"/>
  <text x="450" y="500" text-anchor="middle" fill="#fff7ed" font-family="Arial, sans-serif" font-size="72" font-weight="900">PROMO</text>
  <text x="450" y="595" text-anchor="middle" fill="#fdba74" font-family="Arial, sans-serif" font-size="38" font-weight="800">Imagen no disponible</text>
  <text x="450" y="665" text-anchor="middle" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="28">Usa una URL pública estable</text>
</svg>`);

function normalizePromoImageUrl(raw: unknown) {
  const value = String(raw || '').trim();
  if (!value || value === 'null' || value === 'undefined') return '';
  if (value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.startsWith('//')) return `${window.location.protocol}${value}`;
  try {
    return encodeURI(value);
  } catch {
    return value;
  }
}

function isBlockedHotlinkImageUrl(raw: unknown) {
  const value = normalizePromoImageUrl(raw);
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.includes('fbcdn.net') || host.startsWith('scontent-') || host.includes('facebook.com') || host.includes('instagram.com');
  } catch {
    return false;
  }
}

function buildPromoImageCandidates(raw: unknown) {
  const first = normalizePromoImageUrl(raw);
  const candidates: string[] = [];
  const push = (url: string) => {
    const cleaned = normalizePromoImageUrl(url);
    if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned);
  };

  // Los enlaces de Facebook/Instagram/fbcdn suelen responder 403 por hotlinking o expirar.
  // No los intentamos para evitar imagen rota y errores repetidos en consola.
  if (isBlockedHotlinkImageUrl(first)) {
    push('/promos/promo_placeholder_1.svg');
    push(PROMO_IMAGE_FALLBACK);
    return candidates;
  }

  push(first);

  try {
    if (first && /^https?:\/\//i.test(first)) {
      const u = new URL(first);
      if (u.pathname.includes('/storage/v1/object/sign/')) {
        const publicUrl = new URL(first);
        publicUrl.pathname = publicUrl.pathname.replace('/storage/v1/object/sign/', '/storage/v1/object/public/');
        publicUrl.search = '';
        push(publicUrl.toString());
      }
      if (u.search) {
        const noQuery = new URL(first);
        noQuery.search = '';
        push(noQuery.toString());
      }
      const busted = new URL(first);
      busted.searchParams.set('_imgfix', String(Date.now()));
      push(busted.toString());
    }
  } catch {}

  push('/promos/promo_placeholder_1.svg');
  push(PROMO_IMAGE_FALLBACK);
  return candidates;
}

function SafePromoImage({ src, alt, className }: { src: unknown; alt: string; className?: string }) {
  const candidates = useMemo(() => buildPromoImageCandidates(src), [src]);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    setImgIndex(0);
  }, [src]);

  const safeSrc = candidates[Math.min(imgIndex, Math.max(candidates.length - 1, 0))] || PROMO_IMAGE_FALLBACK;

  return (
    <img
      key={safeSrc}
      src={safeSrc}
      alt={alt}
      className={className || 'h-full w-full object-contain object-center bg-zinc-950'}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      referrerPolicy="no-referrer"
      onError={() => setImgIndex((current) => Math.min(current + 1, Math.max(candidates.length - 1, 0)))}
    />
  );
}


const KEY_TODAY_TITLE = 'promo_today_title';
const KEY_TODAY_IMAGE = 'promo_today_image_url';
const KEY_FEATURED_SLUG = 'promo_featured_slug';
const KEY_TODAY_PRICE = 'promo_today_price';
const KEY_TODAY_DETAIL = 'promo_today_detail';

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
  const [todayPrice, setTodayPrice] = useState('');
  const [todayDetail, setTodayDetail] = useState('');

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
        setTodayPrice(String(c[KEY_TODAY_PRICE] || ''));
        setTodayDetail(String(c[KEY_TODAY_DETAIL] || ''));
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
        { key: KEY_TODAY_PRICE,  text_value: String(todayPrice || '') },
        { key: KEY_TODAY_DETAIL, text_value: String(todayDetail || '') },
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
    <div className="max-w-5xl mx-auto p-4 pb-10 text-zinc-900 dark:text-white">
      <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-sm">
        <div className="text-xl font-black">Promo de hoy</div>
        <div className="mt-1 text-sm text-zinc-650 dark:text-white/70">Selecciona la promo destacada y ajusta el título y la imagen. Incluye vista previa del landing.</div>
      </div>

      {loading && <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 text-zinc-500 dark:text-white/70 animate-pulse">Cargando datos...</div>}
      {!loading && err && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-650 dark:text-red-200"><b>Error:</b> {err}</div>}
      {msg && <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-700 dark:text-emerald-250 font-bold">{msg}</div>}

      {!loading && (
        <div className="mt-4 grid gap-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm">
            <label htmlFor="promo_today_title" className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300">Título de la sección</label>
            <input 
              id="promo_today_title" 
              name="promo_today_title" 
              value={todayTitle} 
              onChange={(e) => setTodayTitle(e.target.value)} 
              className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white px-3.5 py-3 text-sm outline-none focus:border-orange-500/50 shadow-xs" 
            />

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="promo_featured_slug" className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300">Promo destacada vinculada</label>
                <select 
                  id="promo_featured_slug" 
                  name="promo_featured_slug" 
                  value={featuredSlug} 
                  onChange={(e) => setFeaturedSlug(e.target.value)} 
                  className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white px-3.5 py-3 text-sm outline-none focus:border-orange-500/50 shadow-xs"
                >
                  <option value="">(Auto: primera activa)</option>
                  {promos.map((p) => (<option key={p.id} value={p.slug}>{p.name} ({p.slug})</option>))}
                </select>
              </div>

              <div>
                <label htmlFor="promo_today_image_url" className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300">Imagen personalizada (URL)</label>
                <input 
                  id="promo_today_image_url" 
                  name="promo_today_image_url" 
                  value={todayImageUrl} 
                  onChange={(e) => setTodayImageUrl(e.target.value)} 
                  className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white px-3.5 py-3 text-sm outline-none focus:border-orange-500/50 shadow-xs" 
                  placeholder="https://..." 
                />
                <div className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-white/60">Formato ideal: <span className="font-extrabold text-zinc-700 dark:text-white/80">1200×1600 px</span> (proporción 3:4). Se adapta a pantallas móviles sin recortar ni mostrar franjas.</div>
                <div className="mt-2">
                  <button 
                    type="button" 
                    onClick={usePromoImage} 
                    className="rounded-xl border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:text-white transition shadow-xs"
                  >
                    Usar imagen original de la promo
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-150 dark:border-white/5 flex justify-end">
              <button 
                type="button" 
                disabled={saving} 
                onClick={save} 
                className="rounded-xl bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 font-black transition shadow-md active:scale-95 disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300" htmlFor="promo_today_price">Precio destacado de hoy</label>
                <input 
                  id="promo_today_price" 
                  value={todayPrice} 
                  onChange={(e) => setTodayPrice(e.target.value)} 
                  placeholder="Ej: S/ 10.00" 
                  className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white px-3.5 py-3 text-sm outline-none focus:border-orange-500/50 shadow-xs" 
                />
              </div>
              <div>
                <label className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300" htmlFor="promo_today_detail">Detalle o subtítulo destacado</label>
                <input 
                  id="promo_today_detail" 
                  value={todayDetail} 
                  onChange={(e) => setTodayDetail(e.target.value)} 
                  placeholder="Ej: Pizza personal + bebida helada" 
                  className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 text-zinc-900 dark:text-white px-3.5 py-3 text-sm outline-none focus:border-orange-500/50 shadow-xs" 
                />
              </div>
              <div className="md:col-span-2 text-xs text-zinc-450 dark:text-white/50">* Si dejas estos campos en blanco, la app cargará los datos de la promo enlazada de forma automática.</div>
            </div>

            <div className="border-t border-zinc-150 dark:border-white/5 pt-4">
              <div className="text-sm font-extrabold text-zinc-800 dark:text-white mb-3">Vista previa del banner promocional</div>
              <div className="grid md:grid-cols-2 gap-4 items-start">
                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 p-3 bg-zinc-50 dark:bg-black/10">
                  <div className="mx-auto w-full max-w-[360px] aspect-[3/4] overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-zinc-200 dark:ring-white/10">
                    <SafePromoImage src={previewImg || '/promos/promo_placeholder_1.svg'} alt="preview" className="h-full w-full object-contain object-center bg-zinc-950" />
                  </div>
                  <div className="mt-2.5 text-[10px] leading-relaxed text-zinc-500 dark:text-white/50 text-center">Visualización responsiva en 3:4. Se renderiza sin barras ni deformación.</div>
                  {isBlockedHotlinkImageUrl(previewImg) && (
                    <div className="mt-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-100">
                      ⚠️ Esta URL es de redes sociales y podría caducar. Se recomienda subirla al Supabase Storage público para garantizar acceso permanente.
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-2">
                  <div className="text-xl font-black text-zinc-850 dark:text-white">{todayTitle}</div>
                  <div className="text-zinc-650 dark:text-white/70 text-sm">{todayDetail || featuredPromo?.detail_text || featuredPromo?.headline || 'Selecciona una promo para ver detalles...'}</div>
                  <div className="text-3xl font-black text-emerald-600 dark:text-emerald-450 pt-1">
                    {todayPrice || featuredPromo?.price_text || 'S/ 0.00'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
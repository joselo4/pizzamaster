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
                <div className="mt-2 text-[11px] leading-relaxed text-white/60">Formato ideal: <span className="font-semibold text-white/80">1200×1600 px</span> (proporción 3:4). Se mostrará mejor en la vista móvil y evitará franjas negras o escalado extraño.</div>
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
            
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-bold" htmlFor="promo_today_price">Precio de hoy (texto)</label>
                <input id="promo_today_price" value={todayPrice} onChange={(e) => setTodayPrice(e.target.value)} placeholder="S/ 10" className="mt-1 w-full rounded px-3 py-2 bg-white text-gray-900" />
              </div>
              <div>
                <label className="text-sm font-bold" htmlFor="promo_today_detail">Detalle de hoy</label>
                <input id="promo_today_detail" value={todayDetail} onChange={(e) => setTodayDetail(e.target.value)} placeholder="Pizza personal + bebida (delivery hoy)" className="mt-1 w-full rounded px-3 py-2 bg-white text-gray-900" />
              </div>
            </div>
            <div className="mt-3 text-xs text-white/60">Si estos campos están vacíos, se usará el precio/detalle de la promo destacada.</div>
          </div>

            <div className="text-sm font-bold">Vista previa</div>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 p-3 bg-black/10">
                <div className="mx-auto w-full max-w-[480px] aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10">
                  <SafePromoImage src={previewImg || '/promos/promo_placeholder_1.svg'} alt="preview" className="h-full w-full object-contain object-center bg-zinc-950" />
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-white/55">Vista previa completa en 3:4. La imagen no se recorta.</div>
              {isBlockedHotlinkImageUrl(previewImg) && (
                <div className="mt-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
                  Esta URL parece ser de Facebook/Instagram/fbcdn y puede devolver 403 o vencer. Para que la imagen cargue siempre, súbela a Supabase Storage público o usa una URL pública estable.
                </div>
              )}
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
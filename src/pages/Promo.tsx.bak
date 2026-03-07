
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Phone, MessageCircle, Pizza, Sparkles, Flame, Truck, BadgeCheck, ChevronDown } from 'lucide-react';
import { getConfigCache, refreshConfigCache } from '../lib/configCache';
import { setSEO } from '../lib/seo';
import { slugify } from '../lib/promoCampaigns';
import { listActivePromotions, type Promotion } from '../lib/promos';

const DEFAULT_PHONE = '+51989466466';
const DEFAULT_WA = '51989466466';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function safeJson<T>(raw: any, fallback: T): T {
  try {
    if (!raw || typeof raw !== 'string') return fallback;
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export default function Promo() {
  const q = useQuery();
  const isCarlosQR = q.get('ref')?.toLowerCase() === 'carlos';

  const [cfg, setCfg] = useState<any>(() => getConfigCache());
  const [dbPromos, setDbPromos] = useState<Promotion[]>([]);


useEffect(() => {
  try {
    const title = String((cfg?.promo_headline || cfg?.headline || 'Promo'));
    const desc = String((cfg?.promo_body || cfg?.body || 'Pide tu promo.'));
    setSEO({ title, description: desc });
  } catch {}
}, [cfg]);

  useEffect(() => {
    refreshConfigCache().then(setCfg).catch(() => {});
  }, []);

  const promoActive = String(cfg?.promo_active ?? 'true') !== 'false';

  const todayTitle = String(cfg?.promo_today_title || 'Tu promo de hoy');
  const todayImageOverride = String(cfg?.promo_today_image_url || '');
  const featuredSlug = String(cfg?.promo_featured_slug || '');

  const badge = cfg?.promo_badge || 'Publicidad chismosa, promo real.';

  const featuredPromo = useMemo(() => {
    if (!dbPromos || dbPromos.length === 0) return null;
    const slug = String(featuredSlug || '').trim();
    return dbPromos.find((p) => String(p.slug) === slug) || dbPromos[0];
  }, [dbPromos, featuredSlug]);
  const titleA = cfg?.promo_headline || 'Carlos te engaña…';
  const titleB = cfg?.promo_subheadline || 'pero con su dieta.';

  const body = cfg?.promo_body || 'Nuestras pizzas son tan buenas que nadie se resiste. Perdona a Carlos y pide tu promo: pizza personal + botellita de chicha por S/10 (delivery gratis hoy).';

  const priceText = (featuredPromo?.price_text || cfg?.promo_price_text || 'S/ 10');
  const detailText = (featuredPromo?.detail_text || cfg?.promo_detail_text || 'Pizza personal + botellita de chicha');

  const ctaLabel = (featuredPromo?.cta_label || cfg?.promo_cta_label || 'Pedir ahora');
  const ctaCode = (featuredPromo?.cta_code || cfg?.promo_cta_code || 'PROMO');
  const ctaLink = `/pedido?promo=${encodeURIComponent(ctaCode)}`;

  const heroImgUnified = useMemo(() => {
    const o = String(todayImageOverride || '').trim();
    if (o) return o;
    const p = featuredPromo;
    return (p?.image_url || p?.thumb_url || (isCarlosQR ? '/campaigns/carlos_poster_bw.svg' : '/promos/promo_placeholder_1.svg')) as string;
  }, [todayImageOverride, featuredPromo, isCarlosQR]);

  const phone = cfg?.promo_phone || DEFAULT_PHONE;
  const waNumber = cfg?.promo_wa_number || DEFAULT_WA;
  const waMsg = cfg?.promo_wa_message || 'Hola 👋 Quiero la promo CARLOS (S/10: pizza personal + chicha). ¿Me ayudas a pedir?';
  const waUrl = useMemo(() => `https://wa.me/${String(waNumber).replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`, [waNumber, waMsg]);

  const [toast, setToast] = useState(isCarlosQR);

  const defaultPromos = useMemo(() => ([
    { tag: 'TOP', title: 'Promo CARLOS', price: 'S/ 10', note: 'Pizza personal + botellita de chicha', promo: 'CARLOS10', bullets: ['Delivery gratis hoy', 'Cupos limitados', 'Ideal para 1 persona'] },
    { tag: 'COMBO', title: 'Combo 2x Personales', price: 'S/ 24', note: '2 pizzas personales', promo: 'COMBO2', bullets: ['Comparte sin culpa', 'Elige sabores', 'Súmale bebida'] },
    { tag: 'FAMILIAR', title: 'Familiar + Bebida', price: 'S/ 39', note: 'Ideal para 3–4', promo: 'FAMILIAR39', bullets: ['Perfecto para la casa', 'Más queso, más amor', 'Cae bien con chisme'] },
  ]), []);

const promosRaw = safeJson<any[]>(cfg?.promo_promos, defaultPromos);

const promos = useMemo(() => {
  if (!Array.isArray(promosRaw) || promosRaw.length === 0) return defaultPromos;
  const first: any = promosRaw[0] || {};
  const looksLikeCampaign = ('id' in first) && (('headline' in first) || ('name' in first));

  if (looksLikeCampaign) {
    return (promosRaw as any[])
      .filter((c:any) => c?.active !== false)
      .map((c:any) => ({
        id: String(c?.id || ''),
        info_url: c?.info_url ?? null,
        tag: 'PROMO',
        title: c?.headline || c?.name || c?.id,
        price: c?.price_text || '',
        note: c?.detail_text || c?.subheadline || '',
        promo: c?.cta_code || c?.id,
        bullets: [c?.subheadline, c?.detail_text].filter(Boolean),
      }));
  }

  // Legacy cards: agrega id estable (promo code o slug del título)
  return (promosRaw as any[]).map((p:any) => ({
    ...p,
    id: String(p?.promo || slugify(p?.title || p?.name || 'promo')),
    info_url: p?.info_url ?? null,
  }));
}, [promosRaw, defaultPromos]);

  if (!promoActive) {
    return (
      <div className="min-h-screen bg-dark text-white grid place-items-center px-4">
        <div className="max-w-md w-full rounded-3xl bg-card border border-white/10 p-6 text-center">
          <div className="text-3xl font-black">Promo no disponible</div>
          <p className="mt-2 text-slate-300">Vuelve en un rato o haz tu pedido normal.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a className="rounded-2xl border border-white/15 py-3 font-extrabold" href={`tel:${phone}`}>Llamar</a>
            <Link className="rounded-2xl bg-orange-500 py-3 font-extrabold" to="/pedido">Pedir</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-orange-500/20 to-transparent" />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg">
          <div className="rounded-2xl bg-card/95 border border-orange-500/30 shadow-xl p-4 backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-1"><Sparkles className="w-5 h-5 text-orange-400" /></div>
              <div className="flex-1">
                <p className="font-extrabold text-orange-300">Listo, sin molestia 😄</p>
                <p className="text-sm text-slate-200 mt-1 break-words">
                  Tranquil@, el chisme era para que escanees. Carlos solo te engaña con su dieta…
                  y nosotros con una promo buenaza 🍕
                </p>
              </div>
              <button onClick={() => setToast(false)} className="text-slate-300 hover:text-white text-sm font-semibold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-dark/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 grid place-items-center">
              <Pizza className="w-5 h-5 text-orange-400" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold">Promo</div>
              <div className="text-xs text-slate-300">{priceText} • {detailText}</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <a className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold flex items-center gap-2" href={waUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a className="px-3 py-2 rounded-xl border border-white/15 hover:bg-white/5 font-bold flex items-center gap-2" href={`tel:${phone}`}>
              <Phone className="w-4 h-4" /> Llamar
            </a>
            <Link className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 font-extrabold" to={ctaLink}>{ctaLabel}</Link>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="max-w-6xl mx-auto px-4 pt-10 pb-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-sm text-orange-200">
                <Flame className="w-4 h-4" /> {badge}
              </div>

              <h1 className="mt-5 text-4xl sm:text-5xl font-black leading-tight break-words">
                <span className="text-orange-400">{titleA}</span>{' '}
                <span className="text-white">{titleB}</span>
              </h1>

              <p className="mt-4 text-slate-200 text-lg leading-relaxed break-words">{body}</p>

              <div className="mt-6 grid sm:grid-cols-3 gap-3">
                {[{
                  icon: <BadgeCheck className="w-5 h-5 text-emerald-400" />,
                  title: 'Hecha al momento',
                  desc: 'Masa fresca + queso full',
                }, {
                  icon: <Truck className="w-5 h-5 text-emerald-400" />,
                  title: 'Delivery gratis',
                  desc: 'Hoy (por tiempo limitado)',
                }, {
                  icon: <Flame className="w-5 h-5 text-emerald-400" />,
                  title: 'Sabor brutal',
                  desc: 'La dieta no se salva 😅',
                }].map((b, i) => (
                  <div key={i} className="rounded-2xl bg-card border border-white/10 p-4">
                    <div className="flex items-center gap-2 font-bold whitespace-normal break-words max-w-full leading-snug">{b.icon} {b.title}</div>
                    <div className="text-sm text-slate-300 mt-1">{b.desc}</div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Link to={ctaLink} className="rounded-2xl bg-orange-500 hover:bg-orange-600 px-6 py-4 font-black text-center text-lg">
                  {ctaLabel} ({priceText})
                </Link>
                <div className="grid grid-cols-2 gap-3">
                  <a href={`tel:${phone}`} className="rounded-2xl border border-white/15 hover:bg-white/5 px-4 py-4 font-extrabold text-center">
                    <span className="inline-flex items-center justify-center gap-2"><Phone className="w-5 h-5" /> Llamar</span>
                  </a>
                  <a href={waUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-4 font-extrabold text-center">
                    <span className="inline-flex items-center justify-center gap-2"><MessageCircle className="w-5 h-5" /> WhatsApp</span>
                  </a>
                </div>
              </div>

              <div className="mt-6 text-sm text-slate-400 flex items-center gap-2">
                <ChevronDown className="w-4 h-4" /> Baja para ver promos
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-card p-5">
              <div className="mb-4 overflow-hidden rounded-2xl border border-white/10">
                <img src={heroImgUnified} alt="Promo" className="h-48 w-full object-cover" loading="lazy" />
              </div>
              <div className="text-xl font-black">{todayTitle}</div>
              <div className="mt-2 text-slate-300">{detailText}</div>
              <div className="mt-4 text-4xl font-black text-emerald-400">{priceText}</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <a className="rounded-2xl border border-white/15 py-3 font-extrabold text-center" href={`tel:${phone}`}>Llamar</a>
                <a className="rounded-2xl bg-emerald-600 py-3 font-extrabold text-center" href={waUrl} target="_blank" rel="noreferrer">WhatsApp</a>
              </div>
              <Link className="mt-3 block rounded-2xl bg-orange-500 py-3 font-extrabold text-center" to={ctaLink}>Pedir ahora</Link>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 pt-4 pb-28">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black">Promociones 🔥</h2>
              <p className="text-slate-300 mt-1">Elige una y presiona “Pedir”.</p>
            </div>
            <Link to="/pedido" className="text-orange-300 hover:text-orange-200 font-bold">Ver pedido normal →</Link>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {(promos || []).slice(0, 9).map((p: any, i: number) => (
              <div key={i} className="rounded-3xl bg-card border border-white/10 p-5 hover:border-orange-500/40 transition">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-xs font-extrabold text-orange-200">
                    <Sparkles className="w-3.5 h-3.5" /> {p.tag || 'PROMO'}
                  </div>
                  <div className="text-xs text-slate-400">Código: <span className="text-slate-200 font-bold">{p.promo || ''}</span></div>
                </div>

                <div className="mt-4">
                  <div className="text-xl font-black break-words">{p.title || ''}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <div className="text-4xl font-black text-emerald-400">{p.price || ''}</div>
                    <div className="text-slate-300 break-words">{p.note || ''}</div>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-300">
                    {(p.bullets || []).slice(0, 6).map((b: any, j: number) => (
                      <li key={j} className="flex gap-2"><span className="text-emerald-400">✓</span><span className="break-words">{String(b)}</span></li>
                    ))}
                  </ul>
                </div>

                
<div className="mt-5 grid grid-cols-2 gap-2">
  {(() => {
    const pid = String(p.id || p.promo || slugify(p.title) || i);
    const internalInfo = `/promo/${encodeURIComponent(pid)}`;
    const info = p.info_url ? String(p.info_url) : '';
    const isExternal = /^https?:\/\//i.test(info);
    const pedido = `/pedido?promo=${encodeURIComponent(p.promo || '')}&ref=${encodeURIComponent(pid)}`;

    return (
      <>
        {isExternal ? (
          <a href={info} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/15 px-4 py-3 font-black">
            Ver info
          </a>
        ) : (
          <Link to={internalInfo} className="w-full inline-flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/15 px-4 py-3 font-black">
            Ver info
          </Link>
        )}

        <Link to={pedido} className="w-full inline-flex items-center justify-center rounded-2xl bg-orange-500 hover:bg-orange-600 px-4 py-3 font-black">
          Pedir
        </Link>
      </>
    );
  })()}
</div>
              </div>
            ))}
          </div>
        </section>

        {/* Barra fija en móvil */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-dark/90 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-3 gap-2">
            <a className="rounded-xl border border-white/15 py-3 font-extrabold text-center" href={`tel:${phone}`}>Llamar</a>
            <a className="rounded-xl bg-emerald-600 py-3 font-extrabold text-center" href={waUrl} target="_blank" rel="noreferrer">WhatsApp</a>
            <Link className="rounded-xl bg-orange-500 py-3 font-extrabold text-center" to={ctaLink}>Pedir</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
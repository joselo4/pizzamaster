
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Phone, MessageCircle, Pizza, Sparkles, Flame, Truck, BadgeCheck, ChevronDown, HelpCircle, ShieldCheck, Heart, Star, Clock, ArrowRight, Sun, Moon } from 'lucide-react';
import { getConfigCache, refreshConfigCache } from '../lib/configCache';
import { setSEO } from '../lib/seo';
import { slugify } from '../lib/promoCampaigns';
import { listActivePromotions, type Promotion } from '../lib/promos';
import { logPromoEvent } from '../lib/promoEvents';
import SupportChatWidget from '../components/SupportChatWidget';
// PROMO_IMAGE_RATIO_FIX_3_4

const DEFAULT_PHONE = '+51989466466';
const DEFAULT_WA = '51989466466';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}


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
      className={className || 'h-full w-full object-contain object-center bg-white'}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      referrerPolicy="no-referrer"
      onError={() => setImgIndex((current) => Math.min(current + 1, Math.max(candidates.length - 1, 0)))}
    />
  );
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
  // --- TEMA CLARO Y OSCURO DINÁMICO ---
  const [theme, setTheme] = useState(() => {
    try {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const [cfg, setCfg] = useState<any>(() => getConfigCache());
  const [dbPromos, setDbPromos] = useState<Promotion[]>([]);

  // --- NUEVOS ESTADOS DIDÁCTICOS Y VENDEDORES ---
  const [activePizzometroTab, setActivePizzometroTab] = useState<'masa' | 'queso' | 'delivery' | 'chicha'>('masa');
  const [socialProof, setSocialProof] = useState<{ name: string; location: string; promo: string; time: string } | null>(null);
  const [remainingCoupons, setRemainingCoupons] = useState(8);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const pizzometroTabs = {
    masa: {
      label: '🥖 Masa Madurada',
      title: 'Secreto Artesanal: Masa Madurada por 48 Horas',
      desc: 'Nuestra masa se elabora diariamente a mano con harinas seleccionadas y fermenta lentamente en frío. El resultado es un borde aireado (alveolado), crujiente y sumamente ligero.',
      metric: 'Fermentación Lenta'
    },
    queso: {
      label: '🧀 100% Mozzarella',
      title: 'Queso Mozzarella de Primera Calidad',
      desc: 'Cero sucedáneos, cero grasas trans. Usamos únicamente mozzarella pura que se funde uniformemente creando esa textura elástica perfecta y deliciosa que amas.',
      metric: 'Hilos Deliciosos'
    },
    delivery: {
      label: '🚀 Envío Express',
      title: 'Delivery Caliente Directo a tu Mesa',
      desc: 'Nuestros repartidores viajan con mochilas térmicas selladas de alta retención. Tu pizza no se enfría en el camino; llega burbujeante, lista para disfrutar.',
      metric: 'Garantía Térmica'
    },
    chicha: {
      label: '🥤 Chicha Morada',
      title: 'Chicha Morada Casera y Refrescante',
      desc: 'Olvídate de los polvos químicos. Nuestra chicha es 100% natural, hervida con maíz morado de primera, manzana, piña, canela y clavo de olor. ¡El maridaje ideal!',
      metric: 'Receta Secreta'
    }
  };

  const faqs = [
    { q: '¿Cuál es el tiempo estimado de entrega?', a: 'Nuestro promedio de entrega es de 25 a 35 minutos según tu zona. Si hubiese demora, te avisamos de inmediato.' },
    { q: '¿Cómo puedo pagar mi pedido?', a: 'Súper fácil: aceptamos Yape, Plin o Efectivo directo contra entrega al repartidor. Confirmas aquí y pagas en casa.' },
    { q: '¿Qué incluye exactamente la Promo de Hoy?', a: 'Incluye nuestra pizza personal caliente recién horneada (sabor a elegir en la pantalla de pedidos) más una botellita de chicha natural helada.' },
    { q: '¿Puedo pedir desde cualquier distrito?', a: 'Atendemos cobertura amplia local. Al avanzar a la pantalla de pedidos podrás ingresar tu dirección para confirmar la cobertura exacta.' }
  ];

  useEffect(() => {
    try {
      const title = String((cfg?.promo_headline || cfg?.headline || 'Promo'));
      const desc = String((cfg?.promo_body || cfg?.body || 'Pide tu promo.'));
      setSEO({ title, description: desc });
    } catch {}
  }, [cfg]);

  // Reducción paulatina de cupones restantes para crear urgencia sutil
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingCoupons(prev => (prev > 3 ? prev - 1 : prev));
    }, 55000);
    return () => clearInterval(timer);
  }, []);

  // Notificaciones de prueba social dinámicas e interactivas
  useEffect(() => {
    const names = ['María', 'Carlos', 'Diego', 'Lucía', 'Sebastián', 'Renzo', 'Fiorella', 'Juan', 'Camila', 'Alejandro'];
    const locations = ['San Borja', 'Miraflores', 'Surco', 'La Molina', 'San Isidro', 'Magdalena', 'Pueblo Libre', 'Jesús María', 'Lince', 'San Miguel'];
    const promosList = ['Promo CARLOS 🍕', 'Combo 2x Personales 🍕🍕', 'Familiar + Bebida 🥤', 'Promo de Hoy 🔥'];
    const times = ['hace 1 min', 'hace 3 min', 'hace 5 min', 'hace 2 min', 'hace 4 min'];

    const triggerNotification = () => {
      const name = names[Math.floor(Math.random() * names.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const promo = promosList[Math.floor(Math.random() * promosList.length)];
      const time = times[Math.floor(Math.random() * times.length)];
      setSocialProof({ name, location, promo, time });

      // Desvanecer después de 7 segundos
      setTimeout(() => {
        setSocialProof(null);
      }, 7000);
    };

    const initialDelay = setTimeout(triggerNotification, 4000);
    const interval = setInterval(triggerNotification, 19000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    refreshConfigCache().then(setCfg).catch(() => {});
    listActivePromotions().then(setDbPromos).catch(() => {});
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

  // Overrides SOLO para la card "Tu promo de hoy" (quirúrgico)
  const priceTextToday  = (String(cfg?.promo_today_price || '').trim() || priceText);
  const detailTextToday = (String(cfg?.promo_today_detail || '').trim() || detailText);

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
      <div className="min-h-screen bg-slate-50 text-zinc-900 dark:bg-dark dark:text-white grid place-items-center px-4 transition-colors duration-300">
        <div className="max-w-md w-full rounded-3xl bg-white border border-zinc-200 dark:bg-card dark:border-white/10 p-6 text-center shadow-lg dark:shadow-none">
          <div className="text-3xl font-black">Promo no disponible</div>
          <p className="mt-2 text-slate-600 dark:text-slate-350">Vuelve en un rato o haz tu pedido normal.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a className="rounded-2xl border border-zinc-350 dark:border-white/15 py-3 font-extrabold" href={`tel:${phone}`}>Llamar</a>
            <Link className="rounded-2xl bg-orange-500 py-3 font-extrabold text-white" to="/pedido">Pedir</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900 dark:bg-dark dark:text-white transition-colors duration-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-orange-500/10 dark:from-orange-500/20 to-transparent" />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg animate-slide-up-fade">
          <div className="rounded-2xl bg-white/95 dark:bg-card/95 border border-zinc-200 dark:border-orange-500/30 shadow-xl p-4 backdrop-blur text-zinc-800 dark:text-slate-100">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-1"><Sparkles className="w-5 h-5 text-orange-500 dark:text-orange-400" /></div>
              <div className="flex-1">
                <p className="font-extrabold text-orange-600 dark:text-orange-350">Listo, sin molestia 😄</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 break-words">
                  Tranquil@, el chisme era para que escanees. Carlos solo te engaña con su dieta…
                  y nosotros con una promo buenaza 🍕
                </p>
              </div>
              <button onClick={() => setToast(false)} className="text-slate-500 dark:text-slate-350 hover:text-orange-500 dark:hover:text-white text-sm font-semibold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {socialProof && (
        <div className="fixed bottom-24 sm:bottom-8 right-4 z-50 w-[92%] max-w-xs animate-slide-up-fade">
          <div className="rounded-2xl bg-white/95 dark:bg-zinc-950/95 border border-zinc-200 dark:border-orange-500/30 shadow-2xl p-3 backdrop-blur flex items-center gap-3 text-zinc-800 dark:text-white">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/25 dark:border-orange-500/30 flex items-center justify-center text-xl shrink-0">
              🍕
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{socialProof.time}</p>
              <p className="text-xs font-black text-zinc-900 dark:text-white truncate">
                {socialProof.name}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-200 truncate mt-0.5">Pidió: {socialProof.promo}</p>
            </div>
            <div className="shrink-0 text-emerald-500 dark:text-emerald-400"><BadgeCheck className="w-4 h-4" /></div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/90 dark:bg-dark/80 backdrop-blur border-b border-zinc-200 dark:border-white/10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 grid place-items-center">
              <Pizza className="w-5 h-5 text-orange-400" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-zinc-900 dark:text-white">Promo</div>
              <div className="text-xs text-slate-500 dark:text-slate-350">{priceText} • {detailText}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* SUN / MOON TOGGLE */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-zinc-200 dark:border-white/15 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 transition text-zinc-800 dark:text-white flex items-center justify-center shrink-0 shadow-sm"
              title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500 animate-spin-slow" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>

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
      </div>
    </header>

      <main className="relative">
        <section className="max-w-6xl mx-auto px-4 pt-10 pb-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/20 dark:border-orange-500/30 px-3 py-1 text-sm text-orange-600 dark:text-orange-200">
                <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" /> {badge}
              </div>

              <h1 className="mt-5 text-4xl sm:text-5xl font-black leading-tight break-words">
                <span className="text-orange-500 dark:text-orange-400">{titleA}</span>{' '}
                <span className="text-zinc-900 dark:text-white">{titleB}</span>
              </h1>

              <p className="mt-4 text-slate-700 dark:text-slate-200 text-lg leading-relaxed break-words">{body}</p>

              <div className="mt-6 grid sm:grid-cols-3 gap-3">
                {[{
                  icon: <BadgeCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
                  title: 'Hecha al momento',
                  desc: 'Masa fresca + queso full',
                }, {
                  icon: <Truck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
                  title: 'Delivery gratis',
                  desc: 'Hoy (por tiempo limitado)',
                }, {
                  icon: <Flame className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
                  title: 'Sabor brutal',
                  desc: 'La dieta no se salva 😅',
                }].map((b, i) => (
                  <div key={i} className="rounded-2xl bg-white dark:bg-card border border-zinc-200 dark:border-white/10 p-4 shadow-sm dark:shadow-none transition-colors duration-300">
                    <div className="flex items-center gap-2 font-bold whitespace-normal break-words max-w-full leading-snug text-zinc-950 dark:text-white">{b.icon} {b.title}</div>
                    <div className="text-sm text-slate-650 dark:text-slate-300 mt-1">{b.desc}</div>
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

            <div className="rounded-3xl border border-zinc-200 dark:border-orange-500/20 bg-white dark:bg-card p-5 relative overflow-hidden shadow-[0_20px_50px_rgba(249,115,22,0.06)] dark:shadow-[0_20px_50px_rgba(249,115,22,0.12)] group hover:border-orange-500/35 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-full pointer-events-none" />
              {/* FIX: evita que la imagen de la promo se vea entrecortada en /promo. */}
              <div className="mb-4 rounded-2xl border border-white/10 bg-white p-3 shadow-lg ring-1 ring-white/10">
                <div className="mx-auto flex w-full max-w-[480px] aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-white">
                  <SafePromoImage src={heroImgUnified} alt="Promo" className="h-full w-full object-contain object-center bg-white" />
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xl font-black text-zinc-900 dark:text-white">{todayTitle}</div>
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-350">
                  <ShieldCheck className="w-3.5 h-3.5" /> ¡Ahorras S/ 5 hoy!
                </div>
              </div>

              <div className="mt-2 text-slate-650 dark:text-slate-300 text-sm">{detailTextToday}</div>

              {/* URGENCY BAR: cupones restantes */}
              <div className="mt-4 p-3 rounded-2xl bg-orange-500/5 border border-orange-500/15">
                <div className="flex justify-between text-xs font-bold text-orange-600 dark:text-orange-200">
                  <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400 animate-pulse" /> ¡Oferta Exclusiva de Hoy!</span>
                  <span>Quedan {remainingCoupons} promos</span>
                </div>
                <div className="mt-1.5 h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-600 to-amber-400 rounded-full transition-all duration-1000" 
                    style={{ width: `${(remainingCoupons / 8) * 100}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <div className="text-4xl font-black text-emerald-500 dark:text-emerald-400">{priceTextToday}</div>
                <div className="text-xs text-slate-550 dark:text-slate-400 line-through">S/ 15.00</div>
                <div className="text-xs text-orange-650 dark:text-orange-350 font-extrabold">(Delivery gratis hoy)</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <a className="rounded-2xl border border-zinc-350 dark:border-white/15 py-3 font-extrabold text-center hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-800 dark:text-white transition" href={`tel:${phone}`}>Llamar</a>
                <a className="rounded-2xl bg-emerald-600 py-3 font-extrabold text-center hover:bg-emerald-700 text-white transition" href={waUrl} target="_blank" rel="noreferrer">WhatsApp</a>
              </div>
              <Link className="mt-3 block rounded-2xl bg-orange-500 hover:bg-orange-600 py-3.5 font-black text-white text-center text-lg animate-pulse-glow transition-all" to={ctaLink}>
                {ctaLabel}
              </Link>
            </div>
          </div>
        </section>

        {/* NUEVA SECCIÓN DIDÁCTICA: EL PIZZÓMETRO INTERACTIVO */}
        <section className="max-w-6xl mx-auto px-4 py-12 border-t border-zinc-200 dark:border-white/5">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">El <span className="text-orange-500">Pizzómetro</span> de Calidad 🥖</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mt-2 text-sm sm:text-base">Descubre didácticamente por qué nuestras pizzas son las más queridas y vendidas del barrio.</p>
          </div>
          
          <div className="mt-8 grid md:grid-cols-12 gap-6 items-center">
            {/* Tabs selector */}
            <div className="md:col-span-4 flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {Object.entries(pizzometroTabs).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActivePizzometroTab(key as any)}
                  className={`w-full text-left shrink-0 rounded-2xl p-4 font-black transition-all duration-200 flex items-center justify-between border ${activePizzometroTab === key ? 'border-orange-500/30 bg-orange-500/10 dark:bg-orange-500/15 text-orange-655 dark:text-orange-200 shadow-sm' : 'border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-350 hover:bg-zinc-100/80 dark:hover:bg-white/10'}`}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-white/10 text-zinc-600 dark:text-white/70">{item.metric}</span>
                </button>
              ))}
            </div>

            {/* Tab content panel with glassmorphism */}
            <div className="md:col-span-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-gradient-to-tr dark:from-white/5 dark:to-white/[0.02] p-6 shadow-md dark:shadow-none relative overflow-hidden min-h-[220px] flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Pizza className="w-48 h-48 text-zinc-400 dark:text-white" />
              </div>
              <div className="relative z-10">
                <span className="inline-flex items-center gap-1.5 text-xs text-orange-650 dark:text-orange-300 font-extrabold uppercase tracking-widest bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                  <Star className="w-3.5 h-3.5 fill-current" /> Calidad Asegurada
                </span>
                <h3 className="mt-4 text-2xl font-black text-zinc-800 dark:text-white">{pizzometroTabs[activePizzometroTab].title}</h3>
                <p className="mt-3 text-zinc-600 dark:text-zinc-300 text-sm sm:text-base leading-relaxed break-words">
                  {pizzometroTabs[activePizzometroTab].desc}
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Ingredientes 100% reales. Deliciosas de principio a fin.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 pt-4 pb-28">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white">Promociones 🔥</h2>
              <p className="text-zinc-550 dark:text-zinc-400 mt-1">Elige una y presiona “Pedir”.</p>
            </div>
            <Link to="/pedido" className="text-orange-655 dark:text-orange-300 hover:text-orange-500 dark:hover:text-orange-200 font-bold">Ver pedido normal →</Link>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {(promos || []).slice(0, 9).map((p: any, i: number) => {
              const pid = String(p.id || p.promo || slugify(p.title || 'promo') || i);
              const internalInfo = `/promo/info/${encodeURIComponent(pid)}`;
              const info = p.info_url ? String(p.info_url) : '';
              const isExternal = /^https?:\/\//i.test(info);
              const pedido = `/pedido?promo=${encodeURIComponent(p.promo || '')}&ref=${encodeURIComponent(pid)}`;

              return (
                <div key={i} className="rounded-3xl bg-white border border-zinc-200 dark:bg-card dark:border-white/10 p-5 hover:border-orange-500/35 hover:shadow-md shadow-sm dark:shadow-none transition-all duration-300 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/20 dark:border-orange-500/30 px-3 py-1 text-xs font-extrabold text-orange-600 dark:text-orange-200">
                        <Sparkles className="w-3.5 h-3.5" /> {p.tag || 'PROMO'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Código: <span className="text-zinc-800 dark:text-slate-200 font-bold">{p.promo || ''}</span></div>
                    </div>

                    <div className="mt-4">
                      <div className="text-xl font-black text-zinc-900 dark:text-white break-words">{p.title || ''}</div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <div className="text-4xl font-black text-emerald-500 dark:text-emerald-400">{p.price || ''}</div>
                        <div className="text-slate-650 dark:text-slate-350 break-words">{p.note || ''}</div>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        {(p.bullets || []).slice(0, 6).map((b: any, j: number) => (
                          <li key={j} className="flex gap-2"><span className="text-emerald-500 dark:text-emerald-400 font-bold">✓</span><span className="break-words">{String(b)}</span></li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {isExternal ? (
                      <a href={info} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 px-4 py-3 font-black text-zinc-800 dark:text-white transition">
                        Ver info
                      </a>
                    ) : (
                      <Link to={internalInfo} className="w-full inline-flex items-center justify-center rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 px-4 py-3 font-black text-zinc-800 dark:text-white transition">
                        Ver info
                      </Link>
                    )}

                    <Link to={pedido} className="w-full inline-flex items-center justify-center rounded-2xl bg-orange-500 hover:bg-orange-600 px-4 py-3 font-black text-white">
                      Pedir
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        {/* NUEVA SECCIÓN DIDÁCTICA: PREGUNTAS FRECUENTES DESPLEGABLE */}
        <section className="max-w-4xl mx-auto px-4 pb-28">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center justify-center gap-2 text-zinc-950 dark:text-white">
              <HelpCircle className="w-6 h-6 text-orange-500 dark:text-orange-400" /> Preguntas Frecuentes
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">Resolvemos al instante tus dudas para que ordenes con total tranquilidad.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="rounded-2xl border border-zinc-200 dark:border-white/5 bg-white dark:bg-white/[0.02] overflow-hidden transition-all duration-300 hover:border-zinc-300 dark:hover:border-white/10 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-zinc-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-350 transition"
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0 ${openFaq === idx ? 'rotate-180 text-orange-500 dark:text-orange-400' : ''}`} 
                  />
                </button>
                <div 
                  className={`transition-all duration-300 ease-in-out ${openFaq === idx ? 'max-h-48 border-t border-zinc-150 dark:border-white/5 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden bg-zinc-50/50 dark:bg-black/10`}
                >
                  <p className="p-5 text-sm text-slate-700 dark:text-slate-350 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-550/20 p-4 text-center text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Comprar aquí es 100% seguro. Tu información no se comparte de forma indebida.
          </div>
        </section>

        {/* Barra fija en móvil */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-dark/90 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-3 gap-2">
            <a className="rounded-xl border border-zinc-350 dark:border-white/15 py-3 font-extrabold text-center hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-800 dark:text-white transition" href={`tel:${phone}`}>Llamar</a>
            <a className="rounded-xl bg-emerald-600 py-3 font-extrabold text-center text-white" href={waUrl} target="_blank" rel="noreferrer">WhatsApp</a>
            <Link className="rounded-xl bg-orange-500 py-3 font-extrabold text-center text-white" to={ctaLink}>Pedir</Link>
          </div>
        </div>
      </main>

      <SupportChatWidget />
    </div>
  );
}
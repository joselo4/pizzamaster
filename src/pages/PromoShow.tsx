import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPromotionBySlug, type Promotion } from '../lib/promos';
import { Phone, MessageCircle, BadgeCheck, Sparkles, Timer, Pizza } from 'lucide-react';

export default function PromoShow() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    getPromotionBySlug(slug)
      .then(setP)
      .catch(() => setP(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const waUrl = useMemo(() => {
    if (!p?.wa_number) return '';
    const digits = String(p.wa_number).replace(/\D/g, '');
    const msg = encodeURIComponent(p.wa_message || `Hola 👋 Quiero la promo ${p?.name}`);
    return `https://wa.me/${digits}?text=${msg}`;
  }, [p?.wa_number, p?.wa_message, p?.name]);

  const ctaHref = useMemo(() => {
    if (!p) return '/pedido';
    if (p.cta_url) return p.cta_url;
    if (p.cta_code) return `/pedido?promo=${encodeURIComponent(p.cta_code)}`;
    return '/pedido';
  }, [p]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-dark text-white">Cargando…</div>;
  }

  if (!p) {
    navigate('/promos', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/60 to-black" />
        <img
          src={p.image_url || '/promos/promo_placeholder_2.svg'}
          alt={p.name}
          className="w-full max-h-[70vh] object-cover"
        />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-3xl px-4 pb-6">
            {p.badge && (
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/20 text-orange-200 text-xs font-bold px-3 py-1">
                <Sparkles size={14}/> {p.badge}
              </div>
            )}
            <h1 className="mt-2 text-3xl md:text-4xl font-black leading-tight">{p.headline || p.name}</h1>
            {p.subheadline && <p className="mt-1 text-white/80">{p.subheadline}</p>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {p.body && <p className="text-white/90 leading-relaxed">{p.body}</p>}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to={ctaHref} className="rounded-2xl bg-orange-500 py-3 text-center font-extrabold">{p.cta_label || 'Pedir ahora'}</Link>
          {p.phone && (
            <a href={`tel:${p.phone}`} className="rounded-2xl border border-white/15 py-3 text-center font-extrabold flex items-center justify-center gap-2">
              <Phone size={18}/> Llamar
            </a>
          )}
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/15 py-3 text-center font-extrabold flex items-center justify-center gap-2">
              <MessageCircle size={18}/> WhatsApp
            </a>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-orange-300 font-black">
            <BadgeCheck size={18}/> {p.price_text || 'Consulta condiciones'}
          </div>
          {p.detail_text && <div className="mt-1 text-white/80">{p.detail_text}</div>}
        </div>

        {/* Persuasión rápida (si bajan) */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 font-extrabold"><Timer size={18}/> Lista en minutos</div>
            <div className="mt-1 text-white/70 text-sm">Rápida, caliente y directa al antojo.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 font-extrabold"><Pizza size={18}/> Tamaño ideal</div>
            <div className="mt-1 text-white/70 text-sm">Perfecta para ti. Sin compartir si no quieres 😄</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 font-extrabold"><Sparkles size={18}/> Crunch real</div>
            <div className="mt-1 text-white/70 text-sm">Masa fina, crujiente y con queso generoso.</div>
          </div>
        </div>

        <div className="mt-6 text-sm text-white/70">
          <Link to="/promos" className="underline hover:text-white">← Ver todas las promos</Link>
          <span className="mx-2">•</span>
          <Link to="/pedido" className="underline hover:text-white">¿No quieres pepperoni? Mira todo el menú.</Link>
        </div>
      </div>
    </div>
  );
}

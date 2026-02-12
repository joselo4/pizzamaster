import React from 'react';
import { ArrowRight, Phone, MessageCircle } from 'lucide-react';
import type { PromoCampaign } from '../../lib/promoCampaigns';

function themeClasses(theme?: string) {
  switch ((theme || 'amber').toLowerCase()) {
    case 'rose':
      return { bg: 'from-rose-600 to-rose-400', badge: 'bg-rose-100 text-rose-700', btn: 'bg-rose-600 hover:bg-rose-700' };
    case 'indigo':
      return { bg: 'from-indigo-600 to-indigo-400', badge: 'bg-indigo-100 text-indigo-700', btn: 'bg-indigo-600 hover:bg-indigo-700' };
    case 'emerald':
      return { bg: 'from-emerald-600 to-emerald-400', badge: 'bg-emerald-100 text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700' };
    case 'amber':
    default:
      return { bg: 'from-amber-600 to-amber-400', badge: 'bg-amber-100 text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700' };
  }
}

export default function PromoHero({ c }: { c: PromoCampaign }) {
  const t = themeClasses(c.theme);

  const waNumber = c.wa_number ? String(c.wa_number).replace(/\D/g, '') : '';
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(c.wa_message || '')}`
    : null;

  const telHref = c.phone ? `tel:${c.phone}` : null;

  // CTA principal: si hay WhatsApp -> WhatsApp, sino /pedido con ref
  const pedidoHref = c.cta_code
    ? `/pedido?promo=${encodeURIComponent(c.cta_code)}&ref=${encodeURIComponent(c.id)}`
    : `/pedido?ref=${encodeURIComponent(c.id)}`;

  const primaryHref = waHref || pedidoHref;

  return (
    <section className="w-full">
      <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${t.bg} p-6 sm:p-10 text-white shadow-lg`}>
        <div className="max-w-3xl">
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${t.badge}`}>PROMO</div>

          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">{c.headline}</h1>
          {c.subheadline ? <p className="mt-3 text-white/90 text-lg">{c.subheadline}</p> : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {c.price_text ? (
              <span className="rounded-xl bg-black/15 px-3 py-2 text-2xl font-black">{c.price_text}</span>
            ) : null}
            {c.detail_text ? (
              <span className="rounded-xl bg-black/15 px-3 py-2 text-sm sm:text-base">{c.detail_text}</span>
            ) : null}
          </div>

          {c.body ? <p className="mt-4 max-w-2xl text-white/90">{c.body}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={primaryHref}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-black text-white ${t.btn} transition`}
            >
              <ArrowRight size={18} /> {c.cta_label || 'Pedir ahora'}
            </a>

            {telHref ? (
              <a
                href={telHref}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 font-bold text-white hover:bg-white/25"
              >
                <Phone size={16} /> {c.phone}
              </a>
            ) : null}

            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 font-bold text-white hover:bg-white/25"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            ) : null}
          </div>

          <div className="mt-5 text-xs text-white/70">
            Código: <span className="font-bold text-white">{c.cta_code || c.id}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

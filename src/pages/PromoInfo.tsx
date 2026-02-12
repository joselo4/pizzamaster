import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PromoHero from '../components/promo/PromoHero';
import { getConfigPromoRaw, loadPromoCampaigns, slugify } from '../lib/promoCampaigns';

function isHttp(url: string) {
  return /^https?:\/\//i.test(url);
}

export default function PromoInfo() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<any | null>(null);
  const [card, setCard] = useState<any | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    (async () => {
      setStatus('loading');
      const key = String(id || '').toLowerCase();

      // 1) Buscar en campaigns
      const campaigns = await loadPromoCampaigns();
      const found = campaigns.find(c => String(c.id).toLowerCase() === key);
      if (found) {
        setCampaign(found);
        setCard(null);
        setStatus('ready');
        return;
      }

      // 2) Buscar en promo_promos legacy (cards)
      const raw = await getConfigPromoRaw();
      const match = raw.find((p:any) => {
        const promo = String(p?.promo || '').toLowerCase();
        const titleSlug = slugify(p?.title || p?.name || p?.headline);
        return promo === key || titleSlug === key;
      });
      if (match) {
        setCard(match);
        setCampaign(null);
        setStatus('ready');
        return;
      }

      setCampaign(null);
      setCard(null);
      setStatus('notfound');
    })().catch(()=>{});
  }, [id]);

  const view = useMemo(() => {
    if (campaign) {
      return {
        type: 'campaign' as const,
        title: campaign.headline,
        subtitle: campaign.subheadline,
        price: campaign.price_text,
        detail: campaign.detail_text,
        body: campaign.body,
        ctaLabel: campaign.cta_label || 'Pedir ahora',
        promoCode: campaign.cta_code || campaign.id,
        infoUrl: campaign.info_url ? String(campaign.info_url) : null,
        id: campaign.id,
        campaign,
      };
    }
    if (card) {
      const promoCode = String(card.promo || '').trim();
      const title = String(card.title || 'Promo').trim();
      return {
        type: 'card' as const,
        title,
        subtitle: String(card.note || ''),
        price: String(card.price || ''),
        detail: String(card.note || ''),
        body: (Array.isArray(card.bullets) ? card.bullets.join('\n') : ''),
        ctaLabel: 'Pedir',
        promoCode,
        infoUrl: null,
        id: promoCode ? promoCode : slugify(title),
        campaign: {
          id: promoCode ? promoCode : slugify(title),
          name: title,
          active: true,
          headline: title,
          subheadline: String(card.note || ''),
          body: Array.isArray(card.bullets) ? card.bullets.join(' · ') : '',
          price_text: String(card.price || ''),
          detail_text: String(card.note || ''),
          cta_label: 'Pedir',
          cta_code: promoCode,
          theme: 'amber'
        }
      };
    }
    return null;
  }, [campaign, card]);


if (status === 'loading') {
  return (
    <div className="min-h-screen bg-dark text-white px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="animate-pulse">
          <div className="h-6 w-40 bg-white/10 rounded" />
          <div className="mt-4 h-10 w-full bg-white/10 rounded" />
          <div className="mt-3 h-10 w-5/6 bg-white/10 rounded" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-12 bg-white/10 rounded" />
            <div className="h-12 bg-white/10 rounded" />
          </div>
        </div>
        <div className="mt-4 text-xs text-white/60">Cargando información de la promo…</div>
      </div>
    </div>
  );
}

if (!view || status === 'notfound') {
  return (
    <div className="min-h-screen bg-dark text-white px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-2xl font-black">Promo no encontrada</div>
        <p className="mt-2 text-white/70">Revisa el enlace o vuelve a promociones.</p>
        <Link to="/promo" className="mt-4 inline-block rounded-xl bg-white/10 px-4 py-2 font-bold hover:bg-white/15">Volver</Link>
      </div>
    </div>
  );
}

  const pedidoUrl = `/pedido?promo=${encodeURIComponent(view.promoCode || '')}&ref=${encodeURIComponent(view.id)}`;

  return (
    <div className="min-h-screen bg-dark text-white px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link to="/promo" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-extrabold hover:bg-white/15">← Promociones</Link>
          <Link to={`/promo?ref=${encodeURIComponent(view.id)}`} className="text-xs text-white/60 hover:text-white">Ver landing</Link>
        </div>

        <PromoHero c={view.campaign} />

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-black">¿Qué incluye?</div>
            <div className="mt-2 text-white/80 whitespace-pre-line">{view.body || '—'}</div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="font-extrabold">Cómo canjear</div>
              <ol className="mt-2 text-sm text-white/80 list-decimal ml-5 space-y-1">
                <li>Presiona <span className="font-bold">“{view.ctaLabel}”</span> para ir al pedido.</li>
                <li>El código se aplicará como <span className="font-bold">{view.promoCode || view.id}</span>.</li>
                <li>Confirma tu pedido y listo ✅</li>
              </ol>
            </div>

            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/60">Precio / Oferta</div>
                <div className="text-2xl font-black text-emerald-300">{view.price || '—'}</div>
                <div className="text-sm text-white/70 mt-1">{view.detail || ''}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/60">Código</div>
                <div className="text-2xl font-black">{view.promoCode || view.id}</div>
                <div className="text-sm text-white/70 mt-1">Muestra este código si te lo piden.</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={pedidoUrl} className="inline-flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 px-5 py-3 font-black">Pedir ahora</Link>
              <Link to="/pedido" className="inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 px-5 py-3 font-black">Ver pedido normal</Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-black">Información</div>
            <div className="mt-2 text-sm text-white/70">{view.subtitle || view.detail || '—'}</div>

            {view.infoUrl && isHttp(view.infoUrl) ? (
              <a href={view.infoUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full justify-center rounded-xl bg-white/10 px-4 py-2 font-bold hover:bg-white/15">
                Ver web informativa
              </a>
            ) : (
              <div className="mt-4 text-xs text-white/50">Esta promo usa página informativa interna.</div>
            )}

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="font-extrabold">Garantía</div>
              <p className="mt-2 text-sm text-white/80">Si tu pedido llega con un problema, lo resolvemos. Queremos que repitas 🤝</p>
            </div>

            <div className="mt-4 text-xs text-white/50">Tip: comparte este enlace con tus clientes para que vean el detalle de la promo.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

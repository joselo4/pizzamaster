import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { buildTelUrl, buildWhatsAppUrl, listPublicPromotions, type Promotion } from '../lib/promotions';

export default function PromoPublic() {
  const { slug } = useParams();
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setItems(await listPublicPromotions()); }
      finally { setLoading(false); }
    })();
  }, []);

  const promo = useMemo(() => items.find(p => (p.slug ?? String(p.id)) === slug) ?? null, [items, slug]);

  if (loading) return <div className='min-h-screen bg-[#070A12] text-white p-4'>Cargando...</div>;
  if (!promo) return <div className='min-h-screen bg-[#070A12] text-white p-4'>Promo no encontrada. <Link className='underline' to='/promos'>Volver</Link></div>;

  const wa = buildWhatsAppUrl(promo.wa_number, promo.wa_message);
  const tel = buildTelUrl(promo.phone);

  return (
    <div className='min-h-screen bg-[#070A12] text-white'>
      <div className='max-w-3xl mx-auto p-4'>
        <Link to='/promos' className='text-sm text-slate-300 hover:text-white'>← Volver</Link>
        <div className='mt-3 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/40'>
          <div className='h-56 bg-slate-800'>
            {(promo.hero_url || promo.image_url) ? <img src={(promo.hero_url ?? promo.image_url) as string} alt={promo.name} className='w-full h-full object-cover'/> : null}
          </div>
          <div className='p-5 space-y-3'>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl font-bold'>{promo.name}</h1>
              {promo.badge && <span className='text-xs bg-orange-500/15 text-orange-300 px-2 py-0.5 rounded'>{promo.badge}</span>}
            </div>
            {promo.headline && <p className='text-slate-200'>{promo.headline}</p>}
            {promo.subheadline && <p className='text-slate-300'>{promo.subheadline}</p>}
            {promo.body && <p className='text-slate-300 leading-relaxed'>{promo.body}</p>}
            <div className='flex flex-wrap items-center gap-3 pt-2'>
              {promo.price_text && <span className='text-emerald-300 font-semibold text-lg'>{promo.price_text}</span>}
              {promo.detail_text && <span className='text-slate-400'>{promo.detail_text}</span>}
            </div>
            <div className='flex flex-col sm:flex-row gap-2 pt-3'>
              {wa && <a href={wa} target='_blank' rel='noreferrer' className='px-4 py-3 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-center'>{promo.cta_label ?? 'Pedir por WhatsApp'}</a>}
              {tel && <a href={tel} className='px-4 py-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-center'>Llamar</a>}
              <Link to='/pedido' className='px-4 py-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-center'>Ir a pedido</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

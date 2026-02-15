import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPublicPromotions, type Promotion } from '../lib/promotions';

export default function PromosPublic() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setItems(await listPublicPromotions()); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className='min-h-screen bg-[#070A12] text-white'>
      <div className='max-w-5xl mx-auto p-4'>
        <h1 className='text-2xl font-bold'>Promociones</h1>
        <p className='text-slate-300 mb-4'>Ofertas activas por tiempo limitado.</p>
        {loading ? (
          <div className='text-slate-300'>Cargando...</div>
        ) : items.length === 0 ? (
          <div className='text-slate-400'>No hay promociones activas ahora.</div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {items.map(p => (
              <Link key={p.id} to={`/p/${p.slug ?? p.id}`} className='rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden hover:border-orange-500/40 transition'>
                <div className='h-44 bg-slate-800'>
                  {(p.hero_url || p.image_url) ? <img src={(p.hero_url ?? p.image_url) as string} alt={p.name} className='w-full h-full object-cover'/> : null}
                </div>
                <div className='p-4'>
                  <div className='flex items-center gap-2'>
                    <h2 className='font-semibold text-lg'>{p.name}</h2>
                    {p.badge && <span className='text-xs bg-orange-500/15 text-orange-300 px-2 py-0.5 rounded'>{p.badge}</span>}
                  </div>
                  {p.headline && <div className='text-slate-200'>{p.headline}</div>}
                  <div className='text-sm text-slate-400'>{p.detail_text}</div>
                  <div className='text-sm text-emerald-300 font-semibold'>{p.price_text}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listActivePromotions, type Promotion } from '../lib/promos';
import { BadgeCheck, ChevronRight } from 'lucide-react';

export default function Promos() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listActivePromotions().then(setItems).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-orange-500/15 to-transparent" />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Promociones</h1>
            <p className="mt-1 text-white/70">Ofertas activas y campañas especiales.</p>
          </div>
          <Link to="/pedido" className="hidden sm:inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 font-extrabold hover:bg-white/15">
            Ver menú <ChevronRight size={18}/>
          </Link>
        </div>

        {loading && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">Cargando…</div>
        )}

        {!loading && items.length === 0 && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">No hay campañas activas por ahora</div>
            <p className="text-white/70 mt-1">Vuelve más tarde o haz tu pedido normal.</p>
            <div className="mt-4">
              <Link to="/pedido" className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2 font-extrabold">Hacer pedido</Link>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(p => (
            <Link key={p.id} to={`/promo/${encodeURIComponent(p.slug)}`} className="group rounded-3xl overflow-hidden border border-white/10 bg-card hover:border-orange-500/40 transition-colors">
              <div className="aspect-[4/3] w-full overflow-hidden">
                <img
                  src={p.thumb_url || p.image_url || '/promos/promo_placeholder_1.svg'}
                  alt={p.name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-extrabold leading-tight">{p.name}</div>
                  {p.badge && (
                    <span className="text-xs font-bold rounded-full bg-orange-500/20 text-orange-200 px-2 py-1">{p.badge}</span>
                  )}
                </div>
                {p.detail_text && <div className="mt-1 text-sm text-white/80">{p.detail_text}</div>}
                <div className="mt-2 flex items-center gap-2 text-orange-300 font-black">
                  <BadgeCheck size={16}/> {p.price_text || 'Ver detalles'}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 sm:hidden">
          <Link to="/pedido" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 font-extrabold hover:bg-white/15">
            Ver menú <ChevronRight size={18}/>
          </Link>
        </div>
      </div>
    </div>
  );
}

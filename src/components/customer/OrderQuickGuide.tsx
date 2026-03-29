import React from 'react';
import { CheckCircle2, CircleDollarSign, Clock3 } from 'lucide-react';

type OrderQuickGuideProps = {
  title?: string;
  subtitle?: string;
};

const STEPS = [
  { icon: CheckCircle2, title: '1. Elige tus productos', body: 'Filtra por categoría, agrega al carrito y ajusta cantidades sin perder el foco.' },
  { icon: CircleDollarSign, title: '2. Revisa costo y tipo de atención', body: 'Delivery o recojo con costo visible, sin letras pequeñas ni sorpresas.' },
  { icon: Clock3, title: '3. Envía con claridad', body: 'Antes de confirmar verás horario, tiempo estimado y cómo contactarnos si algo falla.' },
];

export default function OrderQuickGuide({ title = 'Pedir es más simple ahora', subtitle = 'Organizamos la experiencia para que el cliente entienda el flujo completo desde el primer vistazo.' }: OrderQuickGuideProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
      <div className="max-w-2xl">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">Guía rápida</div>
        <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">{subtitle}</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <Icon size={18} className="text-cyan-300" />
              <div className="mt-3 text-sm font-bold text-white">{step.title}</div>
              <div className="mt-1 text-sm leading-6 text-white/65">{step.body}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

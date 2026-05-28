import React from 'react';

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export default function SectionCard({ title, eyebrow, action, children }: SectionCardProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? <div className="text-xs uppercase tracking-[0.24em] text-white/45">{eyebrow}</div> : null}
          <h2 className="mt-1 text-xl font-black text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

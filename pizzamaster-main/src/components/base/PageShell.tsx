import React from 'react';

type PageShellProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'default' | 'wide';
};

export default function PageShell({ title, subtitle, action, children, maxWidth = 'wide' }: PageShellProps) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className={`mx-auto px-4 py-6 md:px-6 lg:px-8 ${maxWidth === 'wide' ? 'max-w-7xl' : 'max-w-5xl'}`}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">PizzaMaster</div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">{subtitle}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </div>
    </main>
  );
}

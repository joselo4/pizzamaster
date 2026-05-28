import React from 'react';

type MetricCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  trend?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
};

const toneMap: Record<NonNullable<MetricCardProps['tone']>, string> = {
  default: 'border-white/10 bg-white/5 text-white',
  success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-50',
  danger: 'border-rose-400/30 bg-rose-500/10 text-rose-50',
};

export default function MetricCard({ title, value, hint, trend, tone = 'default' }: MetricCardProps) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] opacity-70">{title}</div>
          <div className="mt-2 text-3xl font-black leading-none">{value}</div>
        </div>
        {trend ? (
          <span className="rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
            {trend}
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-3 text-sm opacity-80">{hint}</div> : null}
    </div>
  );
}

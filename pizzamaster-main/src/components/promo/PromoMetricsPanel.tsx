import React, { useEffect, useMemo, useState } from 'react';
import { getPromoEvents, loadPromoCampaigns, type PromoCampaign } from '../../lib/promoCampaigns';

function dayKey(ts: string) {
  return new Date(ts).toISOString().slice(0,10);
}

function rangeDays(days: number) {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24*60*60*1000);
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}

type DailyPoint = { day: string; views: number; conversions: number };

export default function PromoMetricsPanel() {
  const [days, setDays] = useState(14);
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  const [selected, setSelected] = useState<string>('carlos');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    loadPromoCampaigns().then((c) => {
      setCampaigns(c);
      if (c?.length && !c.find(x=>x.id===selected)) setSelected(c[0].id);
    }).catch(()=>{});
  }, []);

  useEffect(() => {
    getPromoEvents(days).then(setRows).catch(()=>setRows([]));
  }, [days]);

  const daily: DailyPoint[] = useMemo(() => {
    const daysList = rangeDays(days);
    const map: Record<string, DailyPoint> = {};
    for (const d of daysList) map[d] = { day: d, views: 0, conversions: 0 };
    for (const r of rows) {
      if (String(r.campaign_id) !== String(selected)) continue;
      const k = dayKey(r.created_at);
      if (!map[k]) continue;
      if (r.event === 'view') map[k].views += 1;
      if (r.event === 'pedido_visit') map[k].conversions += 1;
    }
    return daysList.map(d => map[d]);
  }, [rows, selected, days]);

  const maxY = useMemo(() => Math.max(1, ...daily.flatMap(p => [p.views, p.conversions])), [daily]);

  const svg = useMemo(() => {
    const w = 820;
    const h = 220;
    const pad = 30;
    const xStep = (w - pad*2) / Math.max(1, daily.length - 1);
    const y = (val: number) => (h - pad) - (val / maxY) * (h - pad*2);
    const line = (key: 'views' | 'conversions') => daily.map((p,i) => `${pad + i*xStep},${y(p[key])}`).join(' ');
    return { w, h, pad, viewsPts: line('views'), convPts: line('conversions') };
  }, [daily, maxY]);

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-black">Métricas por campaña</div>
          <div className="text-xs text-white/60">Vistas y conversiones (llegada a /pedido con ref)</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selected} onChange={(e)=>setSelected(e.target.value)} className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm">
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={days} onChange={(e)=>setDays(Number(e.target.value))} className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm">
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[860px]">
          <svg width={svg.w} height={svg.h} className="rounded-xl bg-black/20 border border-white/10">
            {[0,0.25,0.5,0.75,1].map((t,i) => (
              <line key={i} x1={svg.pad} x2={svg.w-svg.pad} y1={(svg.h-svg.pad) - t*(svg.h-svg.pad*2)} y2={(svg.h-svg.pad) - t*(svg.h-svg.pad*2)} stroke="rgba(255,255,255,0.08)" />
            ))}
            <polyline points={svg.viewsPts} fill="none" stroke="#f59e0b" strokeWidth="3" />
            <polyline points={svg.convPts} fill="none" stroke="#10b981" strokeWidth="3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

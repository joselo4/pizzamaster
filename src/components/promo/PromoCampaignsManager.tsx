import React, { useEffect, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { loadPromoCampaigns, savePromoCampaigns, type PromoCampaign } from '../../lib/promoCampaigns';

export default function PromoCampaignsManager() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PromoCampaign[]>([]);
  const [primary, setPrimary] = useState<string>('carlos');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const campaigns = await loadPromoCampaigns();
      setList(campaigns);
      setPrimary(campaigns.find(c => c.active)?.id || campaigns[0]?.id || 'carlos');
    })().catch(() => {});
  }, [open]);

  const add = () => {
    const id = `promo-${Date.now().toString(36)}`;
    setList(curr => ([...curr, {
      id,
      name: 'Nueva promo',
      active: false,
      priority: 50,
      headline: 'Nueva Promo',
      subheadline: '',
      body: '',
      price_text: '',
      detail_text: '',
      cta_label: 'Pedir ahora',
      cta_code: '',
      info_url: '',
      theme: 'amber'
    } as any]));
  };

  const update = (id: string, patch: Partial<PromoCampaign>) => {
    setList(curr => curr.map(c => c.id === id ? ({ ...c, ...patch }) : c));
  };

  const remove = (id: string) => {
    if (id === 'carlos') return;
    setList(curr => curr.filter(c => c.id !== id));
    if (primary === id) setPrimary('carlos');
  };

  const saveAll = async () => {
    setBusy(true);
    try {
      await savePromoCampaigns(list, primary);
      alert('Promos guardadas ✅');
      setOpen(false);
    } catch (e: any) {
      alert(e?.message || 'Error al guardar');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'border rounded-xl px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center gap-2"
        type="button"
      >
        <Plus size={16} /> Gestionar promos
      </button>

      {open && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center px-3">
          <div className="bg-white text-gray-900 w-full max-w-5xl rounded-2xl shadow-xl p-4 sm:p-6 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black">Promos (múltiples campañas)</h2>
                <p className="text-sm text-gray-600">Edita, activa/desactiva y define una primaria. Cada promo puede tener una URL informativa (externa) o usar /promo/&lt;id&gt;.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-black/5" type="button"><X/></button>
            </div>

            <div className="mt-4 grid gap-3">
              {list.map((c) => (
                <div key={c.id} className="rounded-2xl border border-black/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="checkbox" checked={!!c.active} onChange={(e) => update(c.id, { active: e.target.checked })} />
                      <input className={inputCls + ' font-semibold'} value={c.name || ''} onChange={(e) => update(c.id, { name: e.target.value })} placeholder="Nombre interno" />
                      <span className="text-xs text-gray-500">id:</span>
                      <input className={inputCls + ' text-xs'} value={c.id} onChange={(e) => update(c.id, { id: e.target.value })} disabled={c.id === 'carlos'} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Primaria</span>
                      <input type="radio" name="primaryPromo" checked={primary === c.id} onChange={() => setPrimary(c.id)} />
                    </div>
                  </div>

                  <div className="mt-3 grid sm:grid-cols-2 gap-2">
                    <input className={inputCls} value={c.headline || ''} onChange={(e) => update(c.id, { headline: e.target.value })} placeholder="Headline (título)" />
                    <input className={inputCls} value={c.subheadline || ''} onChange={(e) => update(c.id, { subheadline: e.target.value })} placeholder="Subheadline" />
                    <input className={inputCls} value={c.price_text || ''} onChange={(e) => update(c.id, { price_text: e.target.value })} placeholder="Precio (ej: S/ 10)" />
                    <input className={inputCls} value={c.detail_text || ''} onChange={(e) => update(c.id, { detail_text: e.target.value })} placeholder="Detalle corto" />
                    <input className={inputCls} value={c.cta_label || ''} onChange={(e) => update(c.id, { cta_label: e.target.value })} placeholder="Texto CTA" />
                    <input className={inputCls} value={c.cta_code || ''} onChange={(e) => update(c.id, { cta_code: e.target.value })} placeholder="Código promo" />
                    <input className={inputCls + ' sm:col-span-2'} value={(c as any).info_url || ''} onChange={(e) => update(c.id, { info_url: e.target.value } as any)} placeholder="URL informativa (https://... o vacío para /promo/<id>)" />
                    <input className={inputCls} value={c.theme || ''} onChange={(e) => update(c.id, { theme: e.target.value })} placeholder="Tema (amber/rose/indigo/emerald)" />
                    <input className={inputCls} type="number" value={Number(c.priority || 0)} onChange={(e) => update(c.id, { priority: Number(e.target.value) })} placeholder="Prioridad" />
                    <textarea className={inputCls + ' sm:col-span-2'} rows={3} value={c.body || ''} onChange={(e) => update(c.id, { body: e.target.value })} placeholder="Texto vendedor / condiciones" />
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      disabled={c.id === 'carlos'}
                      onClick={() => remove(c.id)}
                      className="text-red-600 hover:bg-red-50 rounded-xl px-3 py-2 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}

              <button onClick={add} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold" type="button">
                <Plus size={16} /> Agregar promo
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl" type="button">Cerrar</button>
              <button
                onClick={saveAll}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center gap-2 disabled:opacity-60"
                type="button"
              >
                <Save size={16} /> {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

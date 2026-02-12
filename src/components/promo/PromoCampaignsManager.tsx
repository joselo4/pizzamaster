import React, { useEffect, useState } from 'react';
import { loadPromoCampaigns, savePromoCampaigns, type PromoCampaign } from '../../lib/promoCampaigns';
import { Plus, Save, X } from 'lucide-react';

export default function PromoCampaignsManager() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PromoCampaign[]>([]);
  const [primary, setPrimary] = useState<string | undefined>('carlos');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadPromoCampaigns().then((c) => {
      setList(c);
      setPrimary(c.find(x=>x.active)?.id || c[0]?.id);
    }).catch(()=>{});
  }, [open]);

  const add = () => {
    const id = `promo-${Date.now().toString(36)}`;
    setList(curr => ([...curr, { id, name:'Nueva campaña', active:false, priority:50, headline:'Nueva Promo', theme:'amber', info_url: null }]));
  };

  const update = (id: string, patch: Partial<PromoCampaign>) => {
    setList(curr => curr.map(c => c.id===id ? { ...c, ...patch } : c));
  };

  const remove = (id: string) => {
    if (id === 'carlos') return;
    setList(curr => curr.filter(c => c.id!==id));
  };

  const saveAll = async () => {
    setBusy(true);
    try {
      await savePromoCampaigns(list, primary);
      alert('Campañas guardadas ✅');
      setOpen(false);
    } catch (e: any) {
      alert(e?.message || 'Error al guardar campañas');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "border rounded-xl px-2 py-2 bg-white text-gray-900 placeholder:text-gray-400";

  return (
    <>
      <button onClick={()=>setOpen(true)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center gap-2">
        <Plus size={16}/> Gestionar campañas
      </button>

      {open && (
        <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center px-3">
          <div className="bg-white text-gray-900 w-full max-w-5xl rounded-2xl shadow-xl p-4 sm:p-6 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black">Campañas de Promo</h2>
                <p className="text-sm text-gray-600">Crea varias promos personalizables y define URL informativa (si vacía, se usa /promo/&lt;id&gt;).</p>
              </div>
              <button onClick={()=>setOpen(false)} className="p-2 rounded-xl hover:bg-black/5"><X/></button>
            </div>

            <div className="mt-4 grid gap-3">
              {list.map(c => (
                <div key={c.id} className="rounded-2xl border border-black/10 p-3">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="checkbox" checked={c.active} onChange={e=>update(c.id,{active:e.target.checked})}/>
                      <input value={c.name} onChange={e=>update(c.id,{name:e.target.value})} className={inputCls+" font-semibold"}/>
                      <span className="text-xs text-gray-500">id:</span>
                      <input value={c.id} onChange={e=>update(c.id,{id:e.target.value})} className={inputCls+" text-xs"} disabled={c.id==='carlos'}/>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold">Primaria</label>
                      <input type="radio" name="primary" checked={primary===c.id} onChange={()=>setPrimary(c.id)} />
                    </div>
                  </div>

                  <div className="mt-3 grid sm:grid-cols-2 gap-2">
                    <input placeholder="Headline" value={c.headline||''} onChange={e=>update(c.id,{headline:e.target.value})} className={inputCls}/>
                    <input placeholder="Subheadline" value={c.subheadline||''} onChange={e=>update(c.id,{subheadline:e.target.value})} className={inputCls}/>
                    <input placeholder="Precio" value={c.price_text||''} onChange={e=>update(c.id,{price_text:e.target.value})} className={inputCls}/>
                    <input placeholder="Detalle" value={c.detail_text||''} onChange={e=>update(c.id,{detail_text:e.target.value})} className={inputCls}/>
                    <input placeholder="CTA Label" value={c.cta_label||''} onChange={e=>update(c.id,{cta_label:e.target.value})} className={inputCls}/>
                    <input placeholder="CTA Code" value={c.cta_code||''} onChange={e=>update(c.id,{cta_code:e.target.value})} className={inputCls}/>
                    <input placeholder="URL informativa (https://... o /promo/<id>)" value={c.info_url||''} onChange={e=>update(c.id,{info_url:e.target.value})} className={inputCls+" sm:col-span-2"}/>
                    <textarea placeholder="Body" value={c.body||''} onChange={e=>update(c.id,{body:e.target.value})} className={inputCls+" sm:col-span-2"} rows={3}/>
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button disabled={c.id==='carlos'} onClick={()=>remove(c.id)} className="text-red-600 hover:bg-red-50 rounded-xl px-3 py-2 font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Eliminar</button>
                  </div>
                </div>
              ))}

              <button onClick={add} className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold">
                <Plus size={16}/> Agregar campaña
              </button>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={()=>setOpen(false)} className="px-4 py-2 rounded-xl">Cancelar</button>
              <button disabled={busy} onClick={saveAll} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center gap-2">
                <Save size={16}/> {busy? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

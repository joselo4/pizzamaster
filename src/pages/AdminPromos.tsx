import { useEffect, useState } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { listAllPromotionsStaff, type Promotion } from '../lib/promos';
import { Plus, Save, Trash2, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';

const empty: Partial<Promotion> = {
  slug: '',
  name: '',
  badge: 'NUEVA',
  headline: '',
  subheadline: '',
  body: '',
  price_text: 'S/ ',
  detail_text: '',
  cta_label: 'Pedir ahora',
  cta_code: '',
  phone: '',
  wa_number: '',
  wa_message: 'Hola 👋 Quiero esta promo. ¿Me ayudas a pedir?',
  image_url: '',
  thumb_url: '',
  active: true,
  sort_index: 0,
};

export default function AdminPromos() {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [editing, setEditing] = useState<Partial<Promotion> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAllPromotionsStaff();
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const editField = (k: keyof Promotion, v: any) => setEditing(prev => ({ ...(prev || empty), [k]: v }));

  const save = async () => {
    if (!editing) return;
    const payload: any = { ...editing };
    if (!payload.slug || !payload.name) return alert('slug y nombre son obligatorios');

    try {
      if (payload.id) {
        const { error } = await supabase.from('promotions').update(payload).eq('id', payload.id);
        if (error) throw error;
        await logAction('Admin', 'PROMO_UPDATE', payload.slug);
      } else {
        const { error } = await supabase.from('promotions').insert(payload);
        if (error) throw error;
        await logAction('Admin', 'PROMO_CREATE', payload.slug);
      }
      setEditing(null);
      await load();
      alert('✅ Guardado');
    } catch (e: any) {
      alert('❌ ' + (e?.message || e));
    }
  };

  const remove = async (id: number) => {
    if (!confirm('¿Eliminar campaña?')) return;
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) return alert(error.message);
    await logAction('Admin', 'PROMO_DELETE', String(id));
    await load();
  };

  const toggleActive = async (row: Promotion) => {
    const { error } = await supabase.from('promotions').update({ active: !row.active }).eq('id', row.id);
    if (error) return alert(error.message);
    await logAction('Admin', 'PROMO_TOGGLE', `${row.slug} -> ${!row.active}`);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Campañas (Promos)</h2>
        <button onClick={() => setEditing({ ...empty })} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 font-extrabold">
          <Plus size={16}/> Nueva
        </button>
      </div>

      {loading && <div className="text-white/70">Cargando…</div>}

      {!loading && (
        <div className="grid gap-3">
          {rows.map(r => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex gap-3">
                <img src={r.thumb_url || r.image_url || '/promos/promo_placeholder_1.svg'} className="h-16 w-16 rounded-xl object-cover" />
                <div className="flex-1">
                  <div className="font-extrabold">{r.name} <span className="text-white/50">/ {r.slug}</span></div>
                  <div className="text-sm text-white/70">{r.detail_text || r.subheadline}</div>
                  <div className="text-sm text-orange-300 font-black">{r.price_text || '—'}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setEditing(r)} className="rounded-lg border border-white/15 px-3 py-2">Editar</button>
                  <button onClick={() => toggleActive(r)} className="rounded-lg border border-white/15 px-3 py-2 inline-flex items-center gap-2">
                    {r.active ? (<><Eye size={16}/> Activa</>) : (<><EyeOff size={16}/> Inactiva</>)}
                  </button>
                  <button onClick={() => remove(r.id)} className="rounded-lg border border-white/15 px-3 py-2 text-red-300 inline-flex items-center gap-2">
                    <Trash2 size={16}/> Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="slug (ej: carlos10)" value={editing.slug || ''} onChange={e => editField('slug', e.target.value.trim())} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Nombre" value={editing.name || ''} onChange={e => editField('name', e.target.value)} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Badge (TOP/NUEVA/LIMITADA)" value={editing.badge || ''} onChange={e => editField('badge', e.target.value)} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Precio (S/ 10)" value={editing.price_text || ''} onChange={e => editField('price_text', e.target.value)} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2 md:col-span-2" placeholder="Titular (headline)" value={editing.headline || ''} onChange={e => editField('headline', e.target.value)} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2 md:col-span-2" placeholder="Subtitular (subheadline)" value={editing.subheadline || ''} onChange={e => editField('subheadline', e.target.value)} />
            <textarea className="rounded-xl border border-white/15 bg-transparent px-3 py-2 md:col-span-2" rows={3} placeholder="Cuerpo (copy)" value={editing.body || ''} onChange={e => editField('body', e.target.value)} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2 md:col-span-2" placeholder="Detalle corto" value={editing.detail_text || ''} onChange={e => editField('detail_text', e.target.value)} />

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="CTA label" value={editing.cta_label || ''} onChange={e => editField('cta_label', e.target.value)} />
              <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="CTA code (para /pedido?promo=)" value={editing.cta_code || ''} onChange={e => editField('cta_code', e.target.value)} />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Teléfono" value={editing.phone || ''} onChange={e => editField('phone', e.target.value)} />
              <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="WhatsApp (solo dígitos)" value={editing.wa_number || ''} onChange={e => editField('wa_number', e.target.value)} />
            </div>

            <textarea className="rounded-xl border border-white/15 bg-transparent px-3 py-2 md:col-span-2" rows={2} placeholder="Mensaje WhatsApp" value={editing.wa_message || ''} onChange={e => editField('wa_message', e.target.value)} />

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/15 bg-transparent px-3 py-2 flex items-center gap-2">
                <ImageIcon size={16}/>
                <input className="w-full bg-transparent outline-none" placeholder="Image URL (hero)" value={editing.image_url || ''} onChange={e => editField('image_url', e.target.value)} />
              </div>
              <div className="rounded-xl border border-white/15 bg-transparent px-3 py-2 flex items-center gap-2">
                <ImageIcon size={16}/>
                <input className="w-full bg-transparent outline-none" placeholder="Thumb URL" value={editing.thumb_url || ''} onChange={e => editField('thumb_url', e.target.value)} />
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-3 items-center">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.active} onChange={e => editField('active', e.target.checked)} /> Activa</label>
              <input type="number" className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Orden (sort_index)" value={editing.sort_index ?? 0} onChange={e => editField('sort_index', Number(e.target.value))} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button onClick={save} className="rounded-xl bg-orange-500 px-4 py-2 font-extrabold inline-flex items-center gap-2"><Save size={16}/> Guardar</button>
            <button onClick={() => setEditing(null)} className="rounded-xl border border-white/15 px-4 py-2">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

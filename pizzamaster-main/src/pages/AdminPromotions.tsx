import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadPromoImages } from '../lib/promoImageUpload';
import { Plus, Pencil, Trash2, Upload, ExternalLink, Image as ImageIcon } from 'lucide-react';

type PromotionRow = {
  id?: number;
  slug: string;
  name: string;
  badge: string | null;
  headline: string | null;
  subheadline: string | null;
  body: string | null;
  price_text: string | null;
  detail_text: string | null;
  cta_label: string | null;
  cta_code: string | null;
  cta_url: string | null;
  phone: string | null;
  wa_number: string | null;
  wa_message: string | null;
  image_url: string | null;
  thumb_url: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_index: number;
};

const EMPTY: PromotionRow = {
  slug: '',
  name: '',
  badge: null,
  headline: null,
  subheadline: null,
  body: null,
  price_text: '',
  detail_text: null,
  cta_label: 'Pedir ahora',
  cta_code: null,
  cta_url: '/pedido',
  phone: null,
  wa_number: null,
  wa_message: null,
  image_url: null,
  thumb_url: null,
  active: true,
  starts_at: null,
  ends_at: null,
  sort_index: 0,
};

function safeSlug(s: string) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function Thumb({ url, name }: { url?: string | null; name: string }) {
  const ok = !!(url && String(url).trim());
  if (!ok) {
    return (
      <div className="w-20 h-20 rounded bg-gray-100 grid place-items-center text-gray-400">
        <ImageIcon size={18} />
      </div>
    );
  }
  return (
    <img
      src={url!}
      alt={name}
      className="w-20 h-20 object-cover rounded bg-gray-100"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

const inputCls = 'w-full border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 placeholder:text-gray-400';
const textareaCls = 'w-full border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 placeholder:text-gray-400 min-h-[72px]';

export default function AdminPromotions() {
  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState<number | null>(null);
  const pageSize = 18;

  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [uploading, setUploading] = useState(false);

  const range = useMemo(() => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
  }, [page]);

  async function load() {
    setLoading(true);
    setError(null);

    const q = supabase
      .from('promotions')
      // select MINIMO para listar (egress-friendly)
      .select('id, slug, name, badge, price_text, thumb_url, active, sort_index', { count: 'exact' })
      .order('active', { ascending: false })
      .order('sort_index', { ascending: true })
      .order('created_at', { ascending: false })
      .range(range.from, range.to);

    const { data, error, count } = await q;
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((data as any) ?? []);
    setCount(count ?? null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function openEdit(id: number) {
    setError(null);
    const { data, error } = await supabase.from('promotions').select('*').eq('id', id).single();
    if (error) return setError(error.message);
    setEditing(data as any);
  }

  function openNew() {
    setEditing({ ...EMPTY });
  }

  async function save(row: PromotionRow) {
    setError(null);
    const payload: any = { ...row, slug: safeSlug(row.slug || row.name) };
    if (!payload.id) delete payload.id;

    const { error } = await supabase.from('promotions').upsert(payload, { onConflict: 'slug' });
    if (error) return setError(error.message);
    setEditing(null);
    await load();
  }

  async function toggleActive(id: number, active: boolean) {
    const { error } = await supabase.from('promotions').update({ active: !active }).eq('id', id);
    if (error) return setError(error.message);
    await load();
  }

  async function remove(id: number) {
    if (!confirm('¿Eliminar esta promo?')) return;
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) return setError(error.message);
    await load();
  }

  async function handleUpload(file: File) {
    if (!editing) return;
    const slug = safeSlug(editing.slug || editing.name);
    if (!slug) {
      setError('Define primero slug o nombre para subir imágenes.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { thumb_url, image_url } = await uploadPromoImages(file, slug, { bucket: 'pizza-data', baseDir: 'promos' });
      setEditing({ ...editing, thumb_url, image_url });
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  const totalPages = count ? Math.max(1, Math.ceil(count / pageSize)) : null;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Promos (DB) — /promos</h2>
          <p className="text-sm text-gray-500">Editor de <code>public.promotions</code>. (Independiente de <code>/promo</code>.)</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-white" onClick={openNew}>
          <Plus size={16} /> Nueva
        </button>
      </div>

      {error && <div className="mb-3 rounded border border-rose-300 bg-rose-50 p-2 text-rose-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map((r: any) => (
          <div key={r.id} className="rounded border border-white/10 bg-white/5 p-3 flex gap-3 items-start">
            <Thumb url={r.thumb_url} name={r.name} />
            <div className="flex-1">
              <div className="text-xs text-white/60">{r.slug}{r.badge ? ` · ${r.badge}` : ''}</div>
              <div className="font-medium text-white">{r.name}</div>
              <div className="text-amber-400 text-sm">{r.price_text ?? ''}</div>
              <div className="text-xs mt-1 text-white/60">{r.active ? 'Activo' : 'Pausado'} · idx: {r.sort_index ?? 0}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <button className="px-2 py-1 rounded bg-indigo-600 text-white" onClick={() => openEdit(r.id)} title="Editar">
                  <Pencil size={14} />
                </button>
                <button className="px-2 py-1 rounded bg-slate-200 text-slate-900" onClick={() => toggleActive(r.id, r.active)} title="Activar/Pausar">
                  {r.active ? 'Pausar' : 'Activar'}
                </button>
                <button className="px-2 py-1 rounded bg-rose-600 text-white" onClick={() => remove(r.id)} title="Eliminar">
                  <Trash2 size={14} />
                </button>
                <a className="px-2 py-1 rounded bg-white/10 text-white inline-flex items-center gap-1" href={`/promo/${r.slug}`} target="_blank" rel="noreferrer" title="Ver detalle">
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        ))}

        {!loading && rows.length === 0 && <div className="text-sm text-white/60">No hay promos aún. Crea una con “Nueva”.</div>}
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded border border-white/10 text-white/80 disabled:opacity-50">Anterior</button>
        <div className="text-sm text-white/60">{page}{totalPages ? ` / ${totalPages}` : ''}</div>
        <button disabled={totalPages ? page >= totalPages : false} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-white/10 text-white/80 disabled:opacity-50">Siguiente</button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white rounded p-4 w-[760px] max-w-[96vw] max-h-[92vh] overflow-auto text-gray-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{editing.id ? 'Editar promo' : 'Nueva promo'}</h3>
              <button className="px-3 py-1 rounded border" onClick={() => setEditing(null)}>Cerrar</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">Nombre
                <input id="promo_name" name="promo_name" className={inputCls} value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value, slug: editing.slug || safeSlug(e.target.value) })} />
              </label>
              <label className="text-sm">Slug
                <input id="promo_slug" name="promo_slug" className={inputCls} value={editing.slug}
                  onChange={e => setEditing({ ...editing, slug: safeSlug(e.target.value) })} />
              </label>
              <label className="text-sm">Badge
                <input id="promo_badge" name="promo_badge" className={inputCls} value={editing.badge ?? ''}
                  onChange={e => setEditing({ ...editing, badge: e.target.value || null })} />
              </label>
              <label className="text-sm">Precio (texto)
                <input id="promo_price_text" name="promo_price_text" className={inputCls} value={editing.price_text ?? ''}
                  onChange={e => setEditing({ ...editing, price_text: e.target.value })} />
              </label>

              <label className="text-sm col-span-1 md:col-span-2">Titular
                <input id="promo_headline" name="promo_headline" className={inputCls} value={editing.headline ?? ''}
                  onChange={e => setEditing({ ...editing, headline: e.target.value || null })} />
              </label>
              <label className="text-sm col-span-1 md:col-span-2">Subtitular
                <input id="promo_subheadline" name="promo_subheadline" className={inputCls} value={editing.subheadline ?? ''}
                  onChange={e => setEditing({ ...editing, subheadline: e.target.value || null })} />
              </label>
              <label className="text-sm col-span-1 md:col-span-2">Detalle
                <textarea id="promo_detail_text" name="promo_detail_text" className={textareaCls} value={editing.detail_text ?? ''}
                  onChange={e => setEditing({ ...editing, detail_text: e.target.value || null })} />
              </label>

              <label className="text-sm">CTA Label
                <input id="promo_cta_label" name="promo_cta_label" className={inputCls} value={editing.cta_label ?? ''}
                  onChange={e => setEditing({ ...editing, cta_label: e.target.value || null })} />
              </label>
              <label className="text-sm">CTA URL
                <input id="promo_cta_url" name="promo_cta_url" className={inputCls} value={editing.cta_url ?? ''}
                  onChange={e => setEditing({ ...editing, cta_url: e.target.value || null })} />
              </label>

              <label className="text-sm">WhatsApp número
                <input id="promo_wa_number" name="promo_wa_number" className={inputCls} value={editing.wa_number ?? ''}
                  onChange={e => setEditing({ ...editing, wa_number: e.target.value || null })} />
              </label>
              <label className="text-sm">WhatsApp mensaje
                <input id="promo_wa_message" name="promo_wa_message" className={inputCls} value={editing.wa_message ?? ''}
                  onChange={e => setEditing({ ...editing, wa_message: e.target.value || null })} />
              </label>

              <label className="text-sm">Thumb URL (lista)
                <input id="promo_thumb_url" name="promo_thumb_url" className={inputCls} value={editing.thumb_url ?? ''}
                  onChange={e => setEditing({ ...editing, thumb_url: e.target.value || null })} />
              </label>
              <label className="text-sm">Image URL (detalle)
                <input id="promo_image_url" name="promo_image_url" className={inputCls} value={editing.image_url ?? ''}
                  onChange={e => setEditing({ ...editing, image_url: e.target.value || null })} />
              </label>

              <div className="col-span-1 md:col-span-2 flex items-center justify-between rounded border border-gray-200 p-2">
                <div className="text-sm">
                  <div className="font-medium">Subir imagen (opcional)</div>
                  <div className="text-xs text-gray-500">Sube a Storage <code>pizza-data</code> en <code>promos/</code>. WebP 480px + 1280px.</div>
                </div>
                <label className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-white cursor-pointer">
                  <Upload size={16} /> {uploading ? 'Subiendo…' : 'Elegir archivo'}
                  <input id="promo_upload" name="promo_upload" type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </label>
              </div>

              <label className="text-sm">Activo
                <input id="promo_active" name="promo_active" type="checkbox" className="ml-2" checked={editing.active}
                  onChange={e => setEditing({ ...editing, active: e.target.checked })} />
              </label>
              <label className="text-sm">Orden
                <input id="promo_sort_index" name="promo_sort_index" type="number" className={inputCls} value={editing.sort_index}
                  onChange={e => setEditing({ ...editing, sort_index: Number(e.target.value) })} />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button className="px-3 py-2 rounded border" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={() => save(editing)}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

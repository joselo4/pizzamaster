import { useEffect, useMemo, useState } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { Plus, Save, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight, RefreshCw, Ban } from 'lucide-react';

// ✅ ÚNICA CAMPAÑA: este panel edita EXACTAMENTE lo que ves en /promo (config.promo_promos)
// Si config.promo_promos está vacío o inválido, se muestran promos por defecto (las de /promo) para que las guardes.

type ConfigPromoCard = {
  tag?: string;
  title?: string;
  price?: string;
  note?: string;
  promo?: string;
  bullets?: string[];
  info_url?: string | null;
  active?: boolean;
};

type Row = {
  id: number; // índice (1..)
  tag: string;
  title: string;
  price: string;
  note: string;
  promo: string;
  bullets: string; // 1 por línea
  info_url: string;
  active: boolean;
};

const DEFAULT_CARDS: ConfigPromoCard[] = [{"tag": "PROMO", "promo": "CARLOS10", "title": "¡CARLOS TE ENGAÑA! 💔", "price": "S/ 10", "note": "Pizza personal + bebida (hoy)", "bullets": ["...pero tú no te quedas sin cena.", "Pizza personal + bebida (hoy)"], "info_url": null, "active": true}, {"tag": "PROMO", "promo": "COMBO2", "title": "Dos personales, cero drama.", "price": "S/ 24", "note": "2 personales (elige sabores)", "bullets": ["Ideal para compartir (o no).", "2 personales (elige sabores)"], "info_url": null, "active": true}, {"tag": "PROMO", "promo": "FAM", "title": "2 medianas + 1.5L", "price": "S/ 0.00", "note": "2 pizzas medianas + bebida", "bullets": ["Ideal para 4", "2 pizzas medianas + bebida"], "info_url": null, "active": true}, {"tag": "PROMO", "promo": "FAMILIAR39", "title": "Noche de peli + pizza.", "price": "S/ 39", "note": "Familiar + bebida", "bullets": ["Para 3–4 personas.", "Familiar + bebida"], "info_url": null, "active": true}, {"tag": "PROMO", "promo": "2X1WED", "title": "2x1 SOLO HOY 🔥", "price": "Desde S/ 39.90", "note": "2 pizzas (segunda GRATIS)", "bullets": ["Miércoles de antojo.", "2 pizzas (segunda GRATIS)"], "info_url": null, "active": true}, {"tag": "PROMO", "promo": "PAREJA50", "title": "NOCHE DE PAREJA 💘", "price": "S/ 49.90", "note": "2 medianas + 2 bebidas", "bullets": ["Para 2 (o para ti 😄).", "2 medianas + 2 bebidas"], "info_url": null, "active": true}, {"tag": "PROMO", "promo": "OFFICE30", "title": "ALMUERZO EXPRESS ⚡", "price": "S/ 29.90", "note": "2 personales + bebida", "bullets": ["Rápido, rico y rendidor.", "2 personales + bebida"], "info_url": null, "active": true}, {"tag": "PROMO", "promo": "FAMXXL", "title": "COMBO FAMILIAR XXL 🍕🥤", "price": "S/ 119.90", "note": "3 familiares + 2 bebidas 1.5L", "bullets": ["Para 6–8 personas.", "3 familiares + 2 bebidas 1.5L"], "info_url": null, "active": true}, {"tag": "PROMO", "promo": "2X1HAW", "title": "Paga 1 y llévate 2", "price": "S/ 0.00", "note": "2 pizzas (mismo tamaño)", "bullets": ["Jamón + piña", "2 pizzas (mismo tamaño)"], "info_url": null, "active": true}] as any;

const emptyRow = (): Row => ({
  id: -1,
  tag: 'PROMO',
  title: '',
  price: 'S/ ',
  note: '',
  promo: '',
  bullets: '',
  info_url: '',
  active: true,
});

function parseJsonSafe(raw: any): any[] {
  try {
    if (!raw || typeof raw !== 'string') return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function normalizeCards(cards: any[]): ConfigPromoCard[] {
  return (cards || []).map((c: any) => ({
    tag: c?.tag ?? c?.badge ?? 'PROMO',
    title: c?.title ?? c?.headline ?? c?.name ?? '',
    price: c?.price ?? c?.price_text ?? '',
    note: c?.note ?? c?.detail_text ?? c?.subheadline ?? '',
    promo: c?.promo ?? c?.cta_code ?? '',
    bullets: Array.isArray(c?.bullets) ? c.bullets : (typeof c?.body === 'string' ? c.body.split('\n').filter(Boolean) : []),
    info_url: c?.info_url ?? c?.cta_url ?? null,
    active: c?.active !== false,
  }));
}

function cardToRow(card: ConfigPromoCard, idx: number): Row {
  const bulletsArr = Array.isArray(card?.bullets) ? (card!.bullets as string[]) : [];
  return {
    id: idx + 1,
    tag: String(card?.tag ?? 'PROMO'),
    title: String(card?.title ?? ''),
    price: String(card?.price ?? ''),
    note: String(card?.note ?? ''),
    promo: String(card?.promo ?? ''),
    bullets: bulletsArr.join('\n'),
    info_url: String(card?.info_url ?? ''),
    active: card?.active !== false,
  };
}

function rowToCard(row: Row): ConfigPromoCard {
  const bullets = String(row.bullets || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  return {
    tag: row.tag || 'PROMO',
    title: row.title || '',
    price: row.price || '',
    note: row.note || '',
    promo: row.promo || '',
    bullets,
    info_url: row.info_url ? row.info_url : null,
    active: row.active !== false,
  };
}

export default function AdminPromos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  // paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = useMemo(() => Math.max(1, Math.ceil((rows.length || 0) / pageSize)), [rows.length, pageSize]);
  const pagedRows = useMemo(() => {
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const load = async () => {
    setLoading(true);
    setError('');
    setHint('');
    try {
      const { data, error } = await supabase
        .from('config')
        .select('text_value')
        .eq('key', 'promo_promos')
        .limit(1);
      if (error) throw error;

      const raw = (data || [])[0]?.text_value ?? '';
      let cards = normalizeCards(parseJsonSafe(raw));

      const looksEmpty = !cards.length || cards.every(c => !String(c?.promo || '').trim() || !String(c?.title || '').trim());
      if (looksEmpty) {
        cards = normalizeCards(DEFAULT_CARDS);
        setHint('No se encontró promo_promos válido en config. Mostrando promos por defecto (como /promo). Presiona Guardar para aplicarlas.');
      }

      const list = cards.map((c, i) => cardToRow(c, i));
      setRows(list);
      setPage(1);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'No se pudo cargar promo_promos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const persist = async (nextRows: Row[]) => {
    const cards = nextRows.map(rowToCard);
    const payload = [{ key: 'promo_promos', text_value: JSON.stringify(cards) }];
    const { error } = await supabase.from('config').upsert(payload as any, { onConflict: 'key' });
    if (error) throw error;
    await logAction('Admin', 'PROMO_CONFIG_SAVE', String(cards.length));
  };

  const startNew = () => {
    setEditingIndex(-1);
    setEditing(emptyRow());
  };

  const startEdit = (row: Row) => {
    const idx = rows.findIndex(r => r.id === row.id);
    setEditingIndex(idx);
    setEditing({ ...row });
  };

  const save = async () => {
    if (!editing) return;

    const promo = String(editing.promo || '').trim();
    const title = String(editing.title || '').trim();
    if (!promo) return alert('Código es obligatorio (ej: CARLOS10)');
    if (!title) return alert('Título es obligatorio');

    const next = [...rows];
    if (editingIndex === -1) {
      next.push({ ...editing, id: next.length + 1 });
    } else if (editingIndex !== null && editingIndex >= 0) {
      next[editingIndex] = { ...editing, id: rows[editingIndex].id };
    }

    try {
      await persist(next);
      setRows(next);
      setEditing(null);
      setEditingIndex(null);
      setHint('');
      alert('✅ Guardado (esto es lo que se ve en /promo)');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'No se pudo guardar');
    }
  };

  const toggleActive = async (row: Row) => {
    const idx = rows.findIndex(r => r.id === row.id);
    if (idx < 0) return;
    const next = [...rows];
    next[idx] = { ...next[idx], active: !next[idx].active };
    try {
      await persist(next);
      setRows(next);
      await logAction('Admin', 'PROMO_CONFIG_TOGGLE', row.promo);
    } catch (e: any) {
      alert(e?.message || 'No se pudo actualizar');
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`¿Eliminar promo ${row.promo}?`)) return;
    const next = rows.filter(r => r.id !== row.id).map((r, i) => ({ ...r, id: i + 1 }));
    try {
      await persist(next);
      setRows(next);
      await logAction('Admin', 'PROMO_CONFIG_DELETE', row.promo);
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar');
    }
  };

  const disableAllDbPromos = async () => {
    if (!confirm('Esto desactiva TODAS las promos de la tabla promotions (para que no aparezcan en /promos). ¿Continuar?')) return;
    const { error } = await supabase.from('promotions').update({ active: false }).neq('id', 0);
    if (error) return alert(error.message);
    await logAction('Admin', 'PROMO_DB_DISABLE_ALL', 'all');
    alert('✅ Promos de tabla desactivadas');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black">Promos (única campaña)</h2>
          <div className="text-xs text-white/60">Este panel edita EXACTAMENTE lo que ves en /promo (config.promo_promos).</div>
          {hint && <div className="text-xs text-orange-200 mt-1">{hint}</div>}
          {error && <div className="text-xs text-red-300 mt-1">{error}</div>}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-xl border border-white/15 px-3 py-2 inline-flex items-center gap-2"><RefreshCw size={16}/> Recargar</button>
          <button onClick={disableAllDbPromos} className="rounded-xl border border-red-400/30 text-red-200 px-3 py-2 inline-flex items-center gap-2"><Ban size={16}/> Desactivar promos de /promos</button>
          <button onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 font-extrabold"><Plus size={16}/> Nueva</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="text-white/60">Mostrando {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)} de {rows.length}</div>
        <div className="flex items-center gap-2">
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-xl border border-white/15 bg-transparent px-2 py-1">
            <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
          </select>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-xl border border-white/15 px-2 py-1 disabled:opacity-40 inline-flex items-center gap-1"><ChevronLeft size={16}/> Prev</button>
          <div className="px-2 text-white/70">{page}/{totalPages}</div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-xl border border-white/15 px-2 py-1 disabled:opacity-40 inline-flex items-center gap-1">Next <ChevronRight size={16}/></button>
        </div>
      </div>

      {loading && <div className="text-white/70">Cargando…</div>}

      {!loading && (
        <div className="grid gap-3">
          {pagedRows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="font-extrabold">{r.title || '—'} <span className="text-white/50">/ {r.promo || '—'}</span></div>
                  <div className="text-sm text-white/70">{r.note || ''}</div>
                  <div className="text-sm text-orange-300 font-black">{r.price || '—'}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => startEdit(r)} className="rounded-lg border border-white/15 px-3 py-2">Editar</button>
                  <button onClick={() => toggleActive(r)} className="rounded-lg border border-white/15 px-3 py-2 inline-flex items-center gap-2">{r.active ? (<><Eye size={16}/> Activa</>) : (<><EyeOff size={16}/> Inactiva</>)}</button>
                  <button onClick={() => remove(r)} className="rounded-lg border border-white/15 px-3 py-2 text-red-300 inline-flex items-center gap-2"><Trash2 size={16}/> Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="font-black">Editar promo (/promo)</div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditing(null); setEditingIndex(null); }} className="rounded-xl border border-white/15 px-3 py-2">Cerrar</button>
              <button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 font-extrabold"><Save size={16}/> Guardar</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Código (ej: CARLOS10)" value={editing.promo} onChange={e => setEditing({ ...editing, promo: e.target.value.toUpperCase().trim() })} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Tag (PROMO/TOP)" value={editing.tag} onChange={e => setEditing({ ...editing, tag: e.target.value })} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2 md:col-span-2" placeholder="Título" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Precio (S/ 10)" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2" placeholder="Nota (detalle corto)" value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })} />
            <textarea className="rounded-xl border border-white/15 bg-transparent px-3 py-2 md:col-span-2" rows={4} placeholder="Bullets (1 por línea)" value={editing.bullets} onChange={e => setEditing({ ...editing, bullets: e.target.value })} />
            <input className="rounded-xl border border-white/15 bg-transparent px-3 py-2 md:col-span-2" placeholder="URL info (opcional)" value={editing.info_url} onChange={e => setEditing({ ...editing, info_url: e.target.value })} />
            <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} /> Activa</label>
          </div>
        </div>
      )}
    </div>
  );
}

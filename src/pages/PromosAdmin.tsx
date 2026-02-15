import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Copy, ExternalLink, Loader2, Pencil, Plus, Save, Tags, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { buildPromoPublicUrl, buildTelUrl, buildWhatsAppUrl, createPromotion, deletePromotion, listPromotions, setPromotionStatus, slugify, updatePromotion, type Promotion, type PromotionStatus } from '../lib/promotions';

type FormState = Omit<Promotion,'id'|'created_at'|'updated_at'>;
const emptyForm: FormState = { slug:null, name:'', badge:'', headline:'', subheadline:'', body:'', price_text:'', detail_text:'', cta_label:'Pedir ahora', cta_code:'', cta_url:'', phone:'', wa_number:'', wa_message:'', hero_url:'', image_url:'', thumb_url:'', channels:['web','pos'], status:'active', active:true, starts_at:null, ends_at:null, priority:100, sort_index:100 };

async function copyToClipboard(text: string){ try{ await navigator.clipboard.writeText(text); return true;}catch{ return false; } }

export default function PromosAdmin(){
  const [items,setItems]=useState<Promotion[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [toast,setToast]=useState<string|null>(null);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [form,setForm]=useState<FormState>(emptyForm);
  const [q,setQ]=useState('');
  const origin = typeof window!=='undefined' ? window.location.origin : '';

  const filtered = useMemo(()=>{
    const k=q.trim().toLowerCase();
    if(!k) return items;
    return items.filter(p => (p.name??'').toLowerCase().includes(k) || (p.slug??'').toLowerCase().includes(k) || (p.headline??'').toLowerCase().includes(k));
  },[q,items]);

  const load = async ()=>{ setLoading(true); setError(null); try{ setItems(await listPromotions()); } catch(e:any){ setError(e?.message ?? 'Error al cargar'); } finally{ setLoading(false);} };
  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(null),1600); return ()=>clearTimeout(t); },[toast]);

  const startCreate=()=>{ setEditingId(null); setForm({ ...emptyForm, slug:null }); };
  const startEdit=(p:Promotion)=>{ setEditingId(p.id); setForm({ ...emptyForm, ...p, slug:p.slug??null, channels:p.channels??['web','pos'], status:(p.status as PromotionStatus)??'active', active:p.active ?? (p.status==='active'), hero_url:p.hero_url ?? p.image_url ?? '' }); };

  const save=async()=>{
    setSaving(true); setError(null);
    try{
      if(!form.name?.trim()){ setError('El nombre es obligatorio'); return; }
      const next:any={...form};
      if(!next.slug) next.slug=slugify(next.name);
      if(!next.hero_url && next.image_url) next.hero_url=next.image_url;
      if(editingId) await updatePromotion(editingId,next); else await createPromotion(next);
      setToast('✅ Guardado');
      await load();
      setEditingId(null); setForm(emptyForm);
    }catch(e:any){ setError(e?.message ?? 'Error al guardar'); }
    finally{ setSaving(false); }
  };

  const toggleStatus=async(p:Promotion)=>{ setError(null); try{ const next:PromotionStatus = p.status==='active'?'paused':'active'; await setPromotionStatus(p.id,next); await load(); }catch(e:any){ setError(e?.message ?? 'Error al cambiar estado'); } };
  const remove=async(p:Promotion)=>{ if(!confirm(`¿Eliminar la promo “${p.name}”?`)) return; setError(null); try{ await deletePromotion(p.id); setToast('🗑️ Eliminada'); await load(); }catch(e:any){ setError(e?.message ?? 'Error al eliminar'); } };

  const Links=({p}:{p:Promotion})=>{
    const slug=p.slug || String(p.id);
    const publicUrl=buildPromoPublicUrl(origin, slug);
    const wa=buildWhatsAppUrl(p.wa_number,p.wa_message);
    const tel=buildTelUrl(p.phone);
    return (
      <div className='mt-2 space-y-1 text-xs text-slate-200/90'>
        <div className='flex items-center gap-2'>
          <span className='text-slate-400'>Link:</span>
          <a className='underline hover:text-white inline-flex items-center gap-1' href={publicUrl} target='_blank' rel='noreferrer'>
            {publicUrl} <ExternalLink className='w-3 h-3' />
          </a>
          <button className='ml-auto inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700'
            onClick={async()=> (await copyToClipboard(publicUrl)) && setToast('📋 Link copiado')}>
            <Copy className='w-3 h-3'/> Copiar
          </button>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-slate-400'>WhatsApp:</span>
          {wa ? <a className='underline hover:text-white inline-flex items-center gap-1' href={wa} target='_blank' rel='noreferrer'>Abrir <ExternalLink className='w-3 h-3'/></a> : <span className='text-slate-500'>(sin wa_number)</span>}
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-slate-400'>Tel:</span>
          {tel ? <a className='underline hover:text-white' href={tel}>{p.phone}</a> : <span className='text-slate-500'>(sin phone)</span>}
        </div>
      </div>
    );
  };

  return (
    <div className='min-h-screen bg-[#0B0F19] text-white'>
      <div className='p-4 space-y-4 max-w-5xl mx-auto'>
        <header className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <Tags className='w-5 h-5 text-orange-400' />
            <h1 className='text-xl font-semibold'>Promos (editables)</h1>
            <span className='text-xs rounded bg-slate-700/40 text-slate-200 px-2 py-0.5'>No toca /promo (carlos)</span>
          </div>
          <div className='flex gap-2'>
            <input className='px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 text-sm w-48' placeholder='Buscar...' value={q} onChange={e=>setQ(e.target.value)} />
            <button onClick={startCreate} className='inline-flex items-center gap-1 px-3 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white'><Plus className='w-4 h-4'/> Nueva</button>
            <button onClick={load} className='px-3 py-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm'>Recargar</button>
          </div>
        </header>

        {toast && <div className='fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-2 rounded text-sm shadow'>{toast}</div>}

        {error && (
          <div className='border border-red-500/50 bg-red-500/10 text-red-200 rounded p-3 text-sm'>
            <div className='font-semibold'>Error</div>
            <div className='opacity-90'>{error}</div>
            <div className='text-xs opacity-80 mt-2'>Ejecuta SQL: <span className='font-mono'>sql/20A_create_missing_promo_tables.sql</span> y <span className='font-mono'>sql/20B_promos_rls_and_policies_safe.sql</span>.</div>
          </div>
        )}

        <section className='space-y-3'>
          {loading ? (
            <div className='flex items-center gap-2 text-slate-300'><Loader2 className='w-4 h-4 animate-spin'/> Cargando...</div>
          ) : filtered.length===0 ? (
            <div className='text-slate-400'>No hay promos. Crea una con “Nueva” o ejecuta el seed SQL.</div>
          ) : (
            <ul className='space-y-3'>
              {filtered.map(p => (
                <li key={p.id} className='border border-slate-800 rounded-xl p-4 bg-slate-950/40'>
                  <div className='flex flex-col md:flex-row md:items-start md:justify-between gap-3'>
                    <div className='flex gap-3'>
                      <div className='w-20 h-20 rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center'>
                        {(p.hero_url || p.image_url) ? <img src={(p.hero_url ?? p.image_url) as string} className='w-full h-full object-cover' alt={p.name} /> : <span className='text-slate-300 text-xs'>sin imagen</span>}
                      </div>
                      <div>
                        <div className='flex flex-wrap items-center gap-2'>
                          <div className='font-semibold text-lg leading-snug'>{p.name}</div>
                          {p.badge && <span className='text-xs bg-orange-500/15 text-orange-300 px-2 py-0.5 rounded'>{p.badge}</span>}
                          <span className={clsx('text-[11px] px-2 py-0.5 rounded', p.status==='active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/40 text-slate-200')}>{p.status==='active'?'Activa':'Pausada'}</span>
                          <span className='text-[11px] px-2 py-0.5 rounded bg-slate-700/30 text-slate-300'>/{p.slug ?? p.id}</span>
                        </div>
                        {p.headline && <div className='text-slate-200 mt-1'>{p.headline}</div>}
                        <div className='text-sm text-slate-400 mt-1 flex gap-2'>{p.price_text && <span>{p.price_text}</span>}{p.detail_text && <span>• {p.detail_text}</span>}</div>
                        <Links p={p} />
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button onClick={()=>toggleStatus(p)} className='px-2 py-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800' title='Activar/Pausar'>
                        {p.status==='active' ? <ToggleRight className='w-4 h-4 text-emerald-300'/> : <ToggleLeft className='w-4 h-4 text-slate-300'/>}
                      </button>
                      <button onClick={()=>startEdit(p)} className='px-2 py-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800' title='Editar'><Pencil className='w-4 h-4'/></button>
                      <button onClick={()=>remove(p)} className='px-2 py-2 rounded border border-red-700/50 bg-red-500/10 hover:bg-red-500/20' title='Eliminar'><Trash2 className='w-4 h-4 text-red-300'/></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(editingId!==null || form.name) && (
          <section className='border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-3'>
            <div className='flex items-center justify-between'>
              <h2 className='font-semibold'>{editingId ? 'Editar promo' : 'Nueva promo'}</h2>
              <div className='text-xs text-slate-400'>Deja slug vacío y se genera solo.</div>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              <div className='space-y-1'><label className='text-xs text-slate-300'>Nombre*</label>
                <input className='w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white' value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
              </div>
              <div className='space-y-1'><label className='text-xs text-slate-300'>Slug</label>
                <input className='w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white' value={form.slug ?? ''} onChange={e=>setForm({...form,slug:e.target.value})}/>
              </div>
              <div className='space-y-1'><label className='text-xs text-slate-300'>Imagen (URL o /promos/*.png)</label>
                <input className='w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white' value={form.hero_url ?? ''} onChange={e=>setForm({...form,hero_url:e.target.value})}/>
              </div>
              <div className='space-y-1'><label className='text-xs text-slate-300'>WhatsApp (número)</label>
                <input className='w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white' value={form.wa_number ?? ''} onChange={e=>setForm({...form,wa_number:e.target.value})}/>
              </div>
              <div className='md:col-span-2 space-y-1'><label className='text-xs text-slate-300'>Mensaje WhatsApp</label>
                <input className='w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white' value={form.wa_message ?? ''} onChange={e=>setForm({...form,wa_message:e.target.value})}/>
              </div>
              <div className='space-y-1'><label className='text-xs text-slate-300'>Estado</label>
                <select className='w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white' value={form.status} onChange={e=>setForm({...form,status:e.target.value as PromotionStatus})}>
                  <option value='active'>Activa</option>
                  <option value='paused'>Pausada</option>
                  <option value='archived'>Archivada</option>
                </select>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <button onClick={save} disabled={saving} className='inline-flex items-center gap-1 px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60'>
                {saving ? <Loader2 className='w-4 h-4 animate-spin'/> : <Save className='w-4 h-4'/>} Guardar
              </button>
              <button onClick={()=>{setEditingId(null);setForm(emptyForm);}} className='px-4 py-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800'>Cancelar</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

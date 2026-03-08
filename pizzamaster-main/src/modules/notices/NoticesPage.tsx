import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProgram } from '../../core/context/ProgramContext';
import { useAuth } from '../../core/context/AuthContext';
import { fetchNotices, saveNotices, activeNotices, NoticeItem, NoticesPayload } from '../../core/api/notices';
import { usePermissions2 } from '../../core/utils/permissions2';
import { notifySuccess, notifyError } from '../../core/utils/notify';

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const NoticesPage = () => {
  const { program } = useProgram();
  const { session } = useAuth();
  const qc = useQueryClient();

  const { can } = usePermissions2();

  const isEditor = can('notices:edit');

  const { data } = useQuery({
    queryKey: ['avisos', program],
    queryFn: () => fetchNotices(program),
    staleTime: 10_000,
  });

  const active = useMemo(() => activeNotices(data), [data]);

  const persistMerge = async (mutator: (current: NoticesPayload | null) => NoticesPayload) => {
  // Merge seguro: leer el estado actual y aplicar mutación (evita borrar avisos ajenos).
  const current = await fetchNotices(program);
  const next = mutator(current);
  await saveNotices(program, next);
  qc.invalidateQueries({ queryKey: ['avisos', program] });
};


  const meEmail = session?.user?.email || 'unknown';
  const isOwner = (n: NoticeItem) => String(n?.createdBy || '').toLowerCase() === String(meEmail || '').toLowerCase();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('INFO');
  const [expires, setExpires] = useState('');
  const [saving, setSaving] = useState(false);

  const persistItems = async (items: NoticeItem[]) => {
    setSaving(true);
    try {
      const payload: NoticesPayload = {
        updatedAt: new Date().toISOString(),
        updatedBy: session?.user?.email || 'unknown',
        items,
      };
      await persistMerge(() => payload);
      notifySuccess('Avisos actualizados.');
    } catch (e: any) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!isEditor) return notifyError('No tienes permiso para editar avisos.');
    if (!title || !message) return notifyError('Título y mensaje son obligatorios.');

    const n: NoticeItem = {
      id: uid(),
      title: title.toUpperCase(),
      message,
      severity,
      createdAt: new Date().toISOString(),
      createdBy: session?.user?.email || 'unknown',
      expiresAt: expires ? new Date(expires).toISOString() : null,
    };

    await persistItems([n, ...(data?.items || [])]);
    setTitle('');
    setMessage('');
    setSeverity('INFO');
    setExpires('');
  };

  
const remove = async (id: string) => {
    try {
      if (!isEditor) return notifyError('Solo ADMIN puede editar avisos.');
      const current = await fetchNotices(program);
      const item = (current?.items ?? []).find(x => x.id === id);
      if (!item) return;
      if (!isOwner(item)) return notifyError('Solo el creador del aviso puede eliminarlo.');

      await persistMerge((cur) => {
        const c = cur || { updatedAt: new Date().toISOString(), updatedBy: meEmail, items: [] as any[] };
        const items = (c.items || []).filter(x => x.id !== id);
        return { ...c, items, updatedAt: new Date().toISOString(), updatedBy: meEmail };
      });
      notifySuccess('Aviso eliminado.');
    } catch (e) {
      notifyError(e);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded shadow border-l-4 border-indigo-600">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Avisos — {program}</h2>
            <p className="text-xs text-gray-500">Todos pueden ver. Solo ADMIN puede crear/editar/eliminar.</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded ${active.length ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}
          >{active.length ? `${active.length} ACTIVO(S)` : 'SIN AVISOS'}</span>
        </div>
      </div>

      {isEditor && (
        <div className="bg-white p-6 rounded shadow border">
          <h3 className="font-bold text-gray-700 mb-4">Crear aviso</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500">TÍTULO</label>
              <input className="w-full border p-2 rounded" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">SEVERIDAD</label>
              <select className="w-full border p-2 rounded" value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
                <option value="INFO">INFO</option>
                <option value="WARNING">ADVERTENCIA</option>
                <option value="CRITICAL">CRÍTICO</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500">MENSAJE</label>
              <textarea className="w-full border p-2 rounded min-h-[90px]" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">EXPIRA (opcional)</label>
              <input type="date" className="w-full border p-2 rounded" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
            <div className="flex items-end justify-end">
              <button disabled={saving} onClick={add} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold text-sm disabled:bg-gray-300">
                {saving ? 'Guardando...' : 'Publicar aviso'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-bold text-gray-700">Avisos activos</h3>
        </div>
        <div className="divide-y">
          {active.map((n) => (
            <div key={n.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${n.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : n.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}
                  >{n.severity}</span>
                  <h4 className="font-bold text-gray-800">{n.title}</h4>
                </div>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{n.message}</p>
                <p className="text-[10px] text-gray-400 mt-2">Creado por <span className="font-bold">{n.createdBy || '---'}</span> — {new Date(n.createdAt).toLocaleString()}{n.expiresAt ? ` — Expira: ${new Date(n.expiresAt).toLocaleDateString()}` : ''}</p>
              </div>
              {isEditor && isOwner(n) && (
                <button onClick={() => remove(n.id)} className="text-red-600 text-xs font-bold hover:underline">Eliminar</button>
              )}
            </div>
          ))}
          {active.length === 0 && <div className="p-6 text-sm text-gray-400">No hay avisos activos.</div>}
        </div>
      </div>
    </div>
  );
};

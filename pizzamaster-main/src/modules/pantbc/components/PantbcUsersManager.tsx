
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useAuth } from '../../../core/context/AuthContext';
import { isViewer as isViewerRole } from '../../../core/utils/permissions';
import { notifySuccess, notifyError } from '../../../core/utils/notify';
import { Search, Plus, Edit, Save, X, UserX, UserCheck, ShieldAlert } from 'lucide-react';

const REASONS = [
  { key: 'NO_REPORTADO', label: 'No reportado' },
  { key: 'TERMINO_TRATAMIENTO', label: 'Terminó tratamiento' },
  { key: 'ABANDONO', label: 'Abandono' },
  { key: 'OTRO', label: 'Otro' },
];

type Tab = 'ACTIVOS' | 'INACTIVOS';

export const PantbcUsersManager = () => {
  const { role, session } = useAuth();
  const isViewer = isViewerRole(role);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('ACTIVOS');
  const [q, setQ] = useState('');

  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', pin: '', role: 'BENEFICIARIO' });

  const [modalUser, setModalUser] = useState<any>(null);
  const [reason, setReason] = useState('NO_REPORTADO');
  const [justification, setJustification] = useState('');

  const { data: users, error } = useQuery({
    queryKey: ['pantbc_app_users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
  });

  const filtered = useMemo(() => {
    const list = (users || []).filter((u: any) => {
      const mods = u.allowed_modules;
      const inPantbc = Array.isArray(mods) ? mods.includes('PANTBC') : true;
      if (!inPantbc) return false;

      const active = u.is_active !== false;
      if (tab === 'ACTIVOS' && !active) return false;
      if (tab === 'INACTIVOS' && active) return false;

      if (!q) return true;
      const txt = `${u.name || ''} ${u.role || ''}`.toUpperCase();
      return txt.includes(q.toUpperCase());
    });
    return list;
  }, [users, tab, q]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', pin: '', role: 'BENEFICIARIO' });
  };
  const openEdit = (u: any) => {
    setEditing(u);
    setForm({ name: u.name || '', pin: '', role: u.role || 'BENEFICIARIO' });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isViewer) throw new Error('Modo solo lectura.');
      if (!form.name || form.name.trim().length < 3) throw new Error('Nombre obligatorio (mín. 3 caracteres).');

      const payload: any = {
        name: form.name.trim().toUpperCase(),
        role: (form.role || 'BENEFICIARIO').toString().toUpperCase(),
        allowed_modules: ['PANTBC'],
      };
      if (form.pin && String(form.pin).trim().length >= 4) payload.pin = String(form.pin).trim();

      if (editing?.id) {
        const { error } = await supabase.from('app_users').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        payload.is_active = true;
        const { error } = await supabase.from('app_users').insert(payload);
        if (error) throw error;
      }

      supabase.from('audit_logs').insert({
        action: editing?.id ? 'PANTBC_EDITAR_USUARIO' : 'PANTBC_CREAR_USUARIO',
        details: JSON.stringify({ user: payload.name, role: payload.role }),
        user_email: session?.user?.email || 'session',
        program_id: 'PANTBC'
      }).then().catch(()=>{});
    },
    onSuccess: () => {
      notifySuccess(editing?.id ? 'Usuario actualizado.' : 'Usuario creado.');
      queryClient.invalidateQueries({ queryKey: ['pantbc_app_users'] });
      setEditing(null);
      setForm({ name: '', pin: '', role: 'BENEFICIARIO' });
    },
    onError: (e: any) => notifyError(e),
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (isViewer) throw new Error('Modo solo lectura.');
      if (!modalUser) return;
      if ((justification || '').trim().length < 10) throw new Error('La justificación debe tener al menos 10 caracteres.');

      const payload: any = {
        is_active: false,
        inactive_reason_type: reason,
        inactive_justification: justification.trim(),
        inactive_at: new Date().toISOString(),
        inactive_by: session?.user?.id || null,
      };

      const { error } = await supabase.from('app_users').update(payload).eq('id', modalUser.id);
      if (error) throw error;

      supabase.from('audit_logs').insert({
        action: 'PANTBC_DESACTIVAR_USUARIO',
        details: JSON.stringify({ user_id: modalUser.id, name: modalUser.name, reason, justification: payload.inactive_justification }),
        user_email: session?.user?.email || 'session',
        program_id: 'PANTBC'
      }).then().catch(()=>{});
    },
    onSuccess: () => {
      notifySuccess('Usuario desactivado.');
      queryClient.invalidateQueries({ queryKey: ['pantbc_app_users'] });
      setModalUser(null);
      setJustification('');
      setReason('NO_REPORTADO');
    },
    onError: (e: any) => notifyError(e),
  });

  const reactivateMutation = useMutation({
    mutationFn: async (u: any) => {
      if (isViewer) throw new Error('Modo solo lectura.');
      const { error } = await supabase.from('app_users').update({
        is_active: true,
        inactive_reason_type: null,
        inactive_justification: null,
        inactive_at: null,
        inactive_by: null,
      }).eq('id', u.id);
      if (error) throw error;

      supabase.from('audit_logs').insert({
        action: 'PANTBC_REACTIVAR_USUARIO',
        details: JSON.stringify({ user_id: u.id, name: u.name }),
        user_email: session?.user?.email || 'session',
        program_id: 'PANTBC'
      }).then().catch(()=>{});
    },
    onSuccess: () => {
      notifySuccess('Usuario reactivado.');
      queryClient.invalidateQueries({ queryKey: ['pantbc_app_users'] });
    },
    onError: (e: any) => notifyError(e),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-4 rounded shadow border-l-4 border-blue-600 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="font-bold text-gray-800">PANTBC — Beneficiarios (app_users)</div>
        <div className="flex gap-2">
          <button onClick={() => setTab('ACTIVOS')} className={`px-3 py-1 rounded text-sm font-bold border ${tab==='ACTIVOS'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600'}`}>Activos</button>
          <button onClick={() => setTab('INACTIVOS')} className={`px-3 py-1 rounded text-sm font-bold border ${tab==='INACTIVOS'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600'}`}>Inactivos</button>
        </div>
        <div className="relative md:ml-auto">
          <Search className="absolute left-2 top-2 text-gray-400" size={14}/>
          <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Buscar..." className="pl-7 pr-3 py-1 border rounded text-sm"/>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm flex items-center gap-2">
          <ShieldAlert size={16} /> No se pudo cargar <b>app_users</b>.
          <div className="text-xs">{String((error as any)?.message || '')}</div>
        </div>
      )}

      {!isViewer && (
        <div className="bg-white p-4 rounded border">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-gray-700">{editing ? 'Editar usuario' : 'Nuevo usuario'}</div>
            {editing && <button onClick={openNew} className="text-xs font-bold text-gray-500 flex items-center gap-1"><X size={14}/>Cancelar edición</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500">NOMBRE</label>
              <input value={form.name} onChange={e=> setForm({ ...form, name: e.target.value })} className="w-full border p-2 rounded text-sm uppercase" placeholder="NOMBRE"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">PIN (opcional)</label>
              <input value={form.pin} onChange={e=> setForm({ ...form, pin: e.target.value })} className="w-full border p-2 rounded text-sm" placeholder="PIN"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">ROL</label>
              <input value={form.role} onChange={e=> setForm({ ...form, role: e.target.value })} className="w-full border p-2 rounded text-sm" placeholder="BENEFICIARIO"/>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={() => saveMutation.mutate()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2">
              {editing ? <><Save size={16}/>Guardar</> : <><Plus size={16}/>Crear</>}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Motivo</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u: any) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-bold">{u.name}</td>
                <td className="p-3 text-center">{u.role || '—'}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.is_active===false?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{u.is_active===false?'INACTIVO':'ACTIVO'}</span>
                </td>
                <td className="p-3 text-center text-xs">{u.inactive_reason_type || '—'}</td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {!isViewer && (
                      <button onClick={() => openEdit(u)} className="px-2 py-1 border rounded text-xs font-bold flex items-center gap-1"><Edit size={14}/>Editar</button>
                    )}
                    {u.is_active===false ? (
                      <button disabled={isViewer || reactivateMutation.isPending} onClick={()=> reactivateMutation.mutate(u)} className="px-2 py-1 border rounded text-xs font-bold flex items-center gap-1">
                        <UserCheck size={14}/>Reactivar
                      </button>
                    ) : (
                      <button disabled={isViewer} onClick={()=> { setModalUser(u); setReason('NO_REPORTADO'); setJustification(''); }} className="px-2 py-1 border rounded text-xs font-bold flex items-center gap-1 text-red-700 border-red-200 bg-red-50">
                        <UserX size={14}/>Desactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td className="p-5 text-gray-400" colSpan={5}>Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>

      {modalUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded shadow border-t-4 border-red-600 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Desactivar — {modalUser.name}</h3>
              <button onClick={() => setModalUser(null)} className="text-xs font-bold text-gray-500">CERRAR</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500">MOTIVO</label>
                <select value={reason} onChange={e=> setReason(e.target.value)} className="w-full border p-2 rounded text-sm">
                  {REASONS.map(r=> <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500">JUSTIFICACIÓN (obligatoria)</label>
                <textarea value={justification} onChange={e=> setJustification(e.target.value)} className="w-full border p-2 rounded text-sm min-h-[90px]" placeholder="Detalle..." />
                <div className="text-[10px] text-gray-400">Mínimo 10 caracteres.</div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setModalUser(null)} className="px-4 py-2 text-xs font-bold text-gray-600">CANCELAR</button>
                <button onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending || isViewer} className="px-5 py-2 rounded bg-red-600 text-white text-xs font-bold">
                  {deactivateMutation.isPending ? 'PROCESANDO...' : 'CONFIRMAR BAJA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { User, Plus, Trash2, Edit, Save, Key, Shield, Ban, CheckCircle2, RefreshCcw } from 'lucide-react';
import { usePermissions2 } from '../../../core/utils/permissions2';
import { notifySuccess, notifyError } from '../../../core/utils/notify';

export const UsersManager = () => {
  const { can } = usePermissions2();
  const canAdminPerms = can('settings:admin');
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'operator',
    password: '',
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,status,created_at,last_seen_at')
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // 1) Auth: crear usuario solo cuando es NUEVO
      // Importante: supabase.auth.signUp() puede CAMBIAR la sesión al nuevo usuario si Confirm Email está OFF.
      // Para no "botar" al Admin, guardamos la sesión actual y la restauramos al final.
      let authUserId: string | null = null;
      const { data: prevSessionData } = await supabase.auth.getSession();
      const prevSession = prevSessionData?.session || null;

      if (!currentUser) {
        const pwd = data.password || '123456';
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: String(data.email ?? '').trim().toLowerCase(),
          password: pwd,
        });

        if (authError) {
          throw new Error('No se pudo crear el usuario en Auth: ' + authError.message);
        }

        authUserId = authData?.user?.id || null;

        // Si el proyecto devuelve sesión (Confirm Email OFF), restauramos la sesión del admin
        try {
          if (prevSession?.access_token && prevSession?.refresh_token) {
            await supabase.auth.setSession({
              access_token: prevSession.access_token,
              refresh_token: prevSession.refresh_token,
            });
          }
        } catch {
          // best-effort
        }

        if (!authUserId) {
          throw new Error('No se obtuvo ID del usuario creado. Verifica configuración de Auth.');
        }
      }

      const payload: any = {
        email: String(data.email ?? '').trim().toLowerCase(),
        full_name: (data.full_name ?? '').toUpperCase().trim(),
        role: data.role || 'operator',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      };

      if (authUserId) payload.id = authUserId;

      if (currentUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: payload.full_name, role: payload.role, status: payload.status })
          .eq('id', currentUser.id);
        if (error) throw error;
      } else {
        // Evitar duplicate key (profiles_pkey) si existe trigger que crea profiles
        const { data: updated, error: updErr } = await supabase
          .from('profiles')
          .update({ email: payload.email, full_name: payload.full_name, role: payload.role, status: payload.status })
          .eq('id', payload.id)
          .select('id');

        if (!updErr && updated && updated.length > 0) {
          // ok
        } else {
          const { error } = await supabase.from('profiles').insert([payload]);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setIsEditing(false);
      setFormData({ email: '', full_name: '', role: 'operator', password: '' });
      setCurrentUser(null);
      notifySuccess('Usuario guardado.');
    },
    onError: (e: any) => notifyError(e),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('¿Eliminar usuario?')) return;

      // Primero intentamos eliminar el usuario de AUTH (Supabase) vía Edge Function (requiere Service Role en el servidor)
      // Si no existe la función o falla, caemos a eliminar solo el perfil.
      try {
        const { error } = await supabase.functions.invoke('admin-delete-user', { body: { user_id: id } });
        if (error) throw error;
        return;
      } catch (e: any) {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
    onError: (e: any) => notifyError(e),
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: 'ACTIVE' | 'SUSPENDED' }) => {
      const { error } = await supabase.from('profiles').update({ status: nextStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      notifySuccess('Estado del usuario actualizado.');
    },
    onError: (e: any) => notifyError(e),
  });

  return (
    <div className="space-y-6 bg-white p-4 rounded shadow border">
      <div className="flex justify-between items-center border-b pb-4">
        <h3 className="font-bold text-gray-700 flex items-center gap-2"><User size={20}/> Gestión de Usuarios</h3>
        {!isEditing && (
          <button
            onClick={() => {
              setIsEditing(true);
              setCurrentUser(null);
              setFormData({ email: '', full_name: '', role: 'operator', password: '' });
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm flex gap-2"
          >
            <Plus size={16}/> NUEVO
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-blue-50 p-4 rounded border border-blue-200 animate-fade-in mb-4">
          <h4 className="font-bold text-blue-800 mb-2">{currentUser ? 'Editar' : 'Nuevo'} Usuario</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500">NOMBRE</label>
              <input
                className="w-full border p-2 rounded uppercase"
                value={formData.full_name ?? ''}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">EMAIL</label>
              <input
                type="email"
                className="w-full border p-2 rounded lowercase"
                value={formData.email ?? ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                disabled={!!currentUser}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">ROL</label>
              <select
                className="w-full border p-2 rounded bg-white"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="viewer">VISOR (SOLO LECTURA)</option>
                <option value="operator">OPERADOR</option>
                <option value="admin">ADMINISTRADOR</option>
              </select>
            </div>
            {!currentUser && (
              <div>
                <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Key size={12}/> PASS</label>
                <input
                  type="password"
                  className="w-full border p-2 rounded"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password ?? ''}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-500 font-bold text-xs">CANCELAR</button>
            <button
              onClick={() => mutation.mutate(formData)}
              disabled={!String(formData.email ?? '').trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded font-bold text-xs flex items-center gap-2"
            >
              <Save size={14}/> GUARDAR
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-4 text-center">Cargando...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="p-3">Usuario</th>
                <th className="p-3">Rol</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(users || []).map((u: any) => {
                const isSuspended = String(u.status || 'ACTIVE').toUpperCase() === 'SUSPENDED';
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-bold">{(u.full_name ?? '').trim() || '-'}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-gray-200 px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 w-fit">
                          <Shield size={10}/> {u.role}
                        </span>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit ${isSuspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {u.status || 'ACTIVE'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 flex justify-center gap-2">
                      <button
                        onClick={() => {
                          setCurrentUser(u);
                          setFormData({
                            email: (u.email ?? ''),
                            full_name: (u.full_name ?? ''),
                            role: (u.role ?? 'operator'),
                            password: '',
                          });
                          setIsEditing(true);
                        }}
                        className="text-blue-600 p-1"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        onClick={() =>
                          suspendMutation.mutate({
                            id: u.id,
                            nextStatus: isSuspended ? 'ACTIVE' : 'SUSPENDED',
                          })
                        }
                        className={isSuspended ? 'text-green-700 p-1' : 'text-orange-700 p-1'}
                        title={isSuspended ? 'Reactivar' : 'Suspender'}
                      >
                        {isSuspended ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                      </button>

                      <button
                        onClick={() => deleteMutation.mutate(u.id)}
                        className="text-red-600 p-1"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {canAdminPerms && (
        <div className="mt-6 bg-indigo-50 p-4 rounded border border-indigo-200 animate-fade-in">
          <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2"><Shield size={16}/> Permisos avanzados (lectura/escritura, mostrar/ocultar módulos)</h4>
          <p className="text-xs text-indigo-700 mb-3">Estos permisos sobreescriben viewer/operator. Se guardan en <code>user_permissions</code>.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(users || []).map((u: any) => (
              <div key={u.id} className="bg-white border rounded p-3">
                <div className="font-bold text-sm">{u.email}</div>
                <div className="text-[10px] text-gray-500">Rol base: {u.role}</div>
                <UserPermRow userId={u.id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function UserPermRow({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['user_permissions_row', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_permissions').select('*').eq('user_id', userId).maybeSingle();
      if (error) return null;
      return data;
    },
    staleTime: 15_000,
  });

  const perms: any = data?.permissions || {};

  const save = useMutation({
    mutationFn: async (next: any) => {
      const payload = { user_id: userId, permissions: next, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('user_permissions').upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user_permissions_row', userId] }),
    onError: (e: any) => notifyError(e, 'Error guardando permisos avanzados.'),
  });

  const toggle = (key: string) => {
    const next = { ...perms, [key]: !(perms?.[key] === true) };
    save.mutate(next);
  };

  const items: { key: string; label: string }[] = [
    { key: 'all', label: 'Acceso total (override)' },
    { key: 'module:inventory', label: 'Mostrar módulo Inventario' },
    { key: 'module:distribution', label: 'Mostrar módulo Distribución' },
    { key: 'module:directory', label: 'Mostrar módulo Directorio Maestro' },
    { key: 'module:reports', label: 'Mostrar módulo Reportes' },
    { key: 'module:notices', label: 'Mostrar módulo Avisos' },
    { key: 'module:summary', label: 'Mostrar módulo Resumen KPIs' },
    { key: 'module:settings', label: 'Mostrar módulo Configuración' },
    { key: 'pecosas:view', label: 'Ver PECOSAS' },
    { key: 'pecosas:edit', label: 'Anular PECOSAS' },
    { key: 'patients:edit', label: 'Editar/Desactivar pacientes' },
    { key: 'closure:view', label: 'Ver Cierre mensual' },
    { key: 'health:view', label: 'Ver Salud del sistema' },
    { key: 'inventory:write', label: 'Escritura Inventario (override)' },
    { key: 'distribution:write', label: 'Escritura Distribución (override)' },
    { key: 'notices:edit', label: 'Crear/Editar avisos (override)' },
  ];

  const groups: { title: string; keys: string[]; hint?: string }[] = [
    { title: 'Override', keys: ['all'], hint: 'Si está ON, ignora el rol base.' },
    {
      title: 'Módulos (mostrar/ocultar)',
      keys: ['module:inventory','module:distribution','module:directory','module:reports','module:notices','module:summary','module:settings'],
      hint: 'Controla si el módulo aparece en el menú lateral.',
    },
    { title: 'Acciones', keys: ['pecosas:view','pecosas:edit','patients:edit','closure:view','health:view','notices:edit'] },
    { title: 'Escritura (override)', keys: ['inventory:write','distribution:write'] },
  ];

  const labelByKey: any = Object.fromEntries(items.map(i => [i.key, i.label]));

  const reset = () => {
    if (!confirm('¿Restablecer permisos avanzados para este usuario?')) return;
    save.mutate({});
  };

  return (
    <div className="mt-2">
      <div className="flex justify-end">
        <button onClick={reset} className="text-[10px] font-bold px-2 py-1 rounded border bg-white hover:bg-gray-50 flex items-center gap-1">
          <RefreshCcw size={12}/> Reset
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3">
        {groups.map(g => (
          <div key={g.title} className="bg-gray-50 border rounded p-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs text-gray-700">{g.title}</div>
              {g.hint && <div className="text-[10px] text-gray-500">{g.hint}</div>}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1">
              {g.keys.map(k => (
                <button
                  key={k}
                  onClick={() => toggle(k)}
                  className={`text-left text-xs border rounded px-2 py-1 ${perms?.[k]===true ? 'bg-green-100 border-green-200' : 'bg-white'}`}
                  title={k}
                >
                  <span className="font-bold">{labelByKey[k] || k}</span>
                  <span className="text-[10px] text-gray-500 ml-2">{perms?.[k]===true?'ON':'OFF'}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="text-[10px] text-gray-500">Se crea/actualiza la fila en <code>user_permissions</code> automáticamente al guardar.</div>
      </div>
    </div>
  );
}

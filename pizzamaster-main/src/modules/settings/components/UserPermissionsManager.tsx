
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useAuth } from '../../../core/context/AuthContext';
import { notifySuccess, notifyError } from '../../../core/utils/notify';
import { ShieldCheck, Search, Save } from 'lucide-react';

const PERMS: { key: string; label: string; group: string }[] = [
  { key: 'distribution:view', label: 'Distribución - Ver', group: 'Distribución' },
  { key: 'distribution:edit', label: 'Distribución - Editar', group: 'Distribución' },
  { key: 'inventory:view', label: 'Inventario - Ver', group: 'Inventario' },
  { key: 'inventory:edit', label: 'Inventario - Editar', group: 'Inventario' },
  { key: 'centers:view', label: 'Directorios - Ver', group: 'Directorios' },
  { key: 'centers:edit', label: 'Directorios - Editar', group: 'Directorios' },
  { key: 'patients:view', label: 'Pacientes PANTBC - Ver', group: 'PANTBC' },
  { key: 'patients:edit', label: 'Pacientes PANTBC - Editar/Desactivar', group: 'PANTBC' },
  { key: 'reports:view', label: 'Reportes - Ver', group: 'Reportes' },
  { key: 'pecosas:view', label: 'Libro PECOSAS - Ver', group: 'Reportes' },
  { key: 'pecosas:edit', label: 'Libro PECOSAS - Anular', group: 'Reportes' },
  { key: 'closure:view', label: 'Cierre mensual - Ver', group: 'Reportes' },
  { key: 'health:view', label: 'Salud del sistema - Ver', group: 'Reportes' },
  { key: 'settings:view', label: 'Configuración - Ver', group: 'Configuración' },
  { key: 'settings:edit', label: 'Configuración - Editar', group: 'Configuración' },
  { key: 'settings:admin', label: 'Administrar permisos - Ver', group: 'Configuración' },
];

export const UserPermissionsManager = () => {
  const { role } = useAuth();
  const isAdmin = String(role || '').toLowerCase() === 'admin';
  const qc = useQueryClient();

  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const { data: users, error: usersError } = useQuery({
    queryKey: ['rbac_users'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('id,email,full_name,role').order('email');
        if (error) throw error;
        return (data || []).map((u:any)=> ({ ...u, display: `${u.email || ''} ${u.full_name || ''}`.trim() }));
      } catch {
        const { data, error } = await supabase.from('app_users').select('id,name,role').order('name');
        if (error) throw error;
        return (data || []).map((u:any)=> ({ id: u.id, email: null, full_name: u.name, role: u.role, display: u.name }));
      }
    },
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const { data: permsRow, error: permsError } = useQuery({
    queryKey: ['rbac_row', selected?.id],
    queryFn: async () => {
      if (!selected?.id) return null;
      const { data, error } = await supabase.from('user_permissions').select('*').eq('user_id', selected.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && Boolean(selected?.id),
    staleTime: 10_000,
  });

  const current = useMemo(() => (permsRow?.permissions || {}) as Record<string, any>, [permsRow]);

  const grouped = useMemo(() => {
    const by: Record<string, { key: string; label: string }[]> = {};
    PERMS.forEach(p => {
      by[p.group] = by[p.group] || [];
      by[p.group].push({ key: p.key, label: p.label });
    });
    return by;
  }, []);

  const filteredUsers = useMemo(() => {
    const list = users || [];
    if (!q) return list;
    const uq = q.toUpperCase();
    return list.filter((u:any)=> String(u.display||'').toUpperCase().includes(uq));
  }, [users, q]);

  const saveMut = useMutation({
    mutationFn: async (permissions: any) => {
      if (!isAdmin) throw new Error('Solo Admin');
      if (!selected?.id) throw new Error('Seleccione un usuario');
      const payload = { user_id: selected.id, permissions, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('user_permissions').upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      notifySuccess('Permisos guardados.');
      qc.invalidateQueries({ queryKey: ['rbac_row', selected?.id] });
      qc.invalidateQueries({ queryKey: ['user_permissions'] });
    },
    onError: (e:any) => notifyError(e?.message || e)
  });

  const toggle = (key: string) => {
    const next = { ...current, [key]: !(current?.[key] === true) };
    saveMut.mutate(next);
  };

  if (!isAdmin) {
    return <div className="bg-white p-4 rounded border"><div className="font-bold text-gray-700">Permisos por usuario: solo ADMIN.</div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded border flex items-center gap-2">
        <ShieldCheck className="text-indigo-600" />
        <div className="font-bold">Permisos por usuario (RBAC)</div>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-2 text-gray-400" size={14} />
          <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Buscar usuario" className="pl-7 pr-3 py-1 border rounded text-sm" />
        </div>
      </div>

      {usersError && <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded text-sm">No se pudo cargar usuarios: {String((usersError as any)?.message||'')}</div>}
      {permsError && <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded text-sm">No se pudo cargar permisos (¿creaste user_permissions?): {String((permsError as any)?.message||'')}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded border overflow-hidden">
          <div className="p-3 font-bold text-sm border-b">Usuarios</div>
          <div className="max-h-[520px] overflow-auto">
            {(filteredUsers||[]).map((u:any)=> (
              <button key={u.id} onClick={()=> setSelected(u)} className={`w-full text-left p-3 border-b hover:bg-gray-50 ${selected?.id===u.id?'bg-indigo-50':''}`}>
                <div className="font-bold text-sm">{u.email || u.full_name || 'Usuario'}</div>
                <div className="text-[10px] text-gray-500">Rol base: {u.role || '—'}</div>
              </button>
            ))}
            {(!filteredUsers || filteredUsers.length===0) && <div className="p-4 text-gray-400 text-sm">Sin usuarios.</div>}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded border">
          <div className="p-3 border-b flex items-center justify-between">
            <div>
              <div className="font-bold">Permisos</div>
              <div className="text-xs text-gray-500">Usuario: {selected ? (selected.email || selected.full_name) : '—'}</div>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2"><Save size={14}/> Guardado automático</div>
          </div>

          {!selected && <div className="p-6 text-gray-400">Seleccione un usuario para editar permisos.</div>}

          {selected && (
            <div className="p-4 space-y-4">
              {Object.keys(grouped).map(group => (
                <div key={group} className="border rounded">
                  <div className="p-3 font-bold text-sm bg-gray-50 border-b">{group}</div>
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {grouped[group].map(p => (
                      <button key={p.key} onClick={()=> toggle(p.key)} className={`border rounded p-2 text-left text-sm ${current?.[p.key]===true?'bg-green-50 border-green-200':'bg-white'}`}>
                        <div className="font-bold">{p.label}</div>
                        <div className="text-[10px] text-gray-400">{p.key} · {current?.[p.key]===true?'PERMITIDO':'NO'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="text-[11px] text-gray-500">Estos permisos pueden sobreescribir viewer/operator. Si no hay override, se usa rol base.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

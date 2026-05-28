import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../core/api/supabase';
import { usePermissions2 } from '../../core/utils/permissions2';
import { useDbHealth } from '../../core/services/dbHealth';
import { syncQueue } from '../../core/services/offlineQueue';
import { notifySuccess, notifyError } from '../../core/utils/notify';

const fmt = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export const SystemHealth = () => {
  const { can } = usePermissions2();
  const canView = can('health:view');

  const { health: db, refresh } = useDbHealth(30_000);

  const { data: errors, error: e1 } = useQuery({
    queryKey: ['client_errors_last'],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: logs, error: e2 } = useQuery({
    queryKey: ['audit_logs_last'],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  if (!canView) {
    return (
      <div className="bg-white p-6 rounded border">
        <div className="font-bold text-gray-800">Acceso restringido</div>
        <div className="text-sm text-gray-500 mt-1">No tienes permiso para ver Salud del sistema.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Conexión DB */}
      <div className="bg-white p-4 rounded shadow border-l-4 border-sky-600">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Conexión a Base de Datos (Supabase)</h3>
            <p className="text-xs text-gray-500">
              Estado: <span className="font-bold">{db.status}</span>
              {db.latencyMs ? ` · ${db.latencyMs}ms` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded bg-gray-900 text-white text-xs font-bold"
              onClick={() => refresh()}
            >
              Reintentar
            </button>
            <button
              className="px-3 py-2 rounded bg-emerald-600 text-white text-xs font-bold"
              onClick={async () => {
                try {
                  const res = await syncQueue(100);
                  notifySuccess(`Sync offline ejecutado. Sincronizado: ${res.synced}`);
                } catch (e) {
                  notifyError(e);
                }
              }}
            >
              Sync offline
            </button>
          </div>
        </div>

        {db.status !== 'online' && (
          <div className="mt-2 text-xs text-red-700">
            Si el proyecto estuvo inactivo varios días, puede tardar en despertar. Reintente en 30–60s.
          </div>
        )}
      </div>

      {/* Errores globales */}
      {(e1 || e2) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {String((e1 as any)?.message || (e2 as any)?.message || '')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client errors */}
        <div className="bg-white rounded border overflow-hidden">
          <div className="p-3 font-bold">Errores (últimos 200)</div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {(errors ?? []).map((x: any) => (
                  <tr key={x.id} className="border-b">
                    <td className="p-2 text-gray-500">{new Date(x.created_at).toLocaleString()}</td>
                    <td className="p-2">{fmt(x.type)}</td>
                    <td className="p-2">{fmt(x.message)}</td>
                  </tr>
                ))}
                {(!errors || errors.length === 0) && (
                  <tr>
                    <td className="p-4 text-gray-400" colSpan={3}>
                      Sin errores.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit logs */}
        <div className="bg-white rounded border overflow-hidden">
          <div className="p-3 font-bold">Auditoría (últimos 200)</div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Acción</th>
                  <th className="p-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((l: any) => (
                  <tr key={l.id} className="border-b">
                    <td className="p-2 text-gray-500">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-2">{fmt(l.action)}</td>
                    <td className="p-2">{fmt(l.details)}</td>
                  </tr>
                ))}
                {(!logs || logs.length === 0) && (
                  <tr>
                    <td className="p-4 text-gray-400" colSpan={3}>
                      Sin registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

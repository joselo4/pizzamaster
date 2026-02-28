import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { FileText, User, Clock, ShieldAlert } from 'lucide-react';

export const AuditLogViewer = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      // Obtenemos logs combinados de movimientos y auditoría
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    }
  });

  if (isLoading) return <div className="p-4 text-center">Cargando historial...</div>;

  return (
    <div className="bg-white rounded shadow border border-gray-200">
      <div className="p-4 border-b flex items-center gap-2 bg-gray-50">
        <ShieldAlert size={20} className="text-blue-600" />
        <h3 className="font-bold text-gray-700">Registro de Auditoría y Cambios</h3>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600 sticky top-0">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Usuario</th>
              <th className="p-3">Acción</th>
              <th className="p-3">Detalle / Nota Obligatoria</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs?.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap text-gray-500">
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    {/* CORRECCIÓN: Uso de fecha nativa en lugar de date-fns */}
                    {new Date(log.created_at).toLocaleString('es-PE', { 
                        day: '2-digit', month: '2-digit', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                    })}
                  </div>
                </td>
                <td className="p-3 font-medium text-blue-700">
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    {log.user_email || 'Sistema'}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    log.action.includes('ELIMINAR') ? 'bg-red-100 text-red-700' :
                    log.action.includes('STOCK') ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="p-3 text-gray-600">
                  <div className="flex items-start gap-2">
                    <FileText size={14} className="mt-1 text-gray-400 shrink-0" />
                    <span>{log.details || log.observation || 'Sin detalles'}</span>
                  </div>
                </td>
              </tr>
            ))}
            {logs?.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">No hay registros recientes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
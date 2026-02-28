import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../core/api/supabase';
import { useProgram } from '../../core/context/ProgramContext';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react'; // CORREGIDO: Se quitó 'Package'

export const Dashboard = () => {
  const { programId, programName } = useProgram();

  // 1. Contar Centros/Beneficiarios
  const { data: stats } = useQuery({
    queryKey: ['dashboard_stats', programId],
    queryFn: async () => {
      const { count: centersCount } = await supabase.from('centers').select('*', { count: 'exact', head: true }).eq('program_id', programId);
      const { data: centers } = await supabase.from('centers').select('active_beneficiaries').eq('program_id', programId);
      const totalBenef = centers?.reduce((sum, c) => sum + (c.active_beneficiaries || 0), 0) || 0;
      return { centersCount, totalBenef };
    }
  });

  // 2. Alertas de Stock Bajo
  const { data: lowStock } = useQuery({
    queryKey: ['low_stock', programId],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('program_id', programId).lt('stock_current', (Number(localStorage.getItem('low_stock_threshold'))||50)); // Umbral de ejemplo
      return data || [];
    }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-800">Resumen: {programName}</h2>
      
      {/* TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase">Centros / Puntos</p>
              <p className="text-3xl font-bold text-blue-700">{stats?.centersCount || 0}</p>
            </div>
            <Users size={32} className="text-blue-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase">Beneficiarios</p>
              <p className="text-3xl font-bold text-green-700">{stats?.totalBenef || 0}</p>
            </div>
            <TrendingUp size={32} className="text-green-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded shadow border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase">Alertas Stock</p>
              <p className="text-3xl font-bold text-orange-700">{lowStock?.length || 0}</p>
            </div>
            <AlertTriangle size={32} className="text-orange-200" />
          </div>
        </div>
      </div>

      {/* LISTA RÁPIDA DE ALERTAS */}
      {lowStock && lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded p-4">
          <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2"><AlertTriangle size={18}/> Productos con Stock Bajo</h3>
          <ul className="space-y-1">
            {lowStock.map((p: any) => (
              <li key={p.id} className="text-sm text-orange-700 flex justify-between border-b border-orange-200 pb-1">
                <span>{p.name}</span>
                <span className="font-bold">{p.stock_current} {p.unit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
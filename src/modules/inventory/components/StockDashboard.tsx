import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { AlertTriangle, PackageCheck } from 'lucide-react';

export const StockDashboard = () => {
  const { programId } = useProgram();

  const { data: products } = useQuery({
    queryKey: ['products', programId],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('program_id', programId)
        .order('name');
      return data || [];
    }
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Estado del Almacén</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tarjetas de Resumen */}
        <div className="bg-blue-600 text-white p-4 rounded shadow">
          <p className="text-blue-100 text-sm">Total Productos</p>
          <p className="text-3xl font-bold">{products?.length || 0}</p>
        </div>
        <div className="bg-green-600 text-white p-4 rounded shadow">
          <p className="text-green-100 text-sm">Valorizado Total</p>
          <p className="text-3xl font-bold">
            S/. {products?.reduce((acc, p) => acc + (p.stock_current * p.average_cost), 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Tabla Detallada */}
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidad</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Físico</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Promedio</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products?.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.unit}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">
                  <span className={product.stock_current < 10 ? 'text-red-600 flex justify-end items-center gap-1' : 'text-gray-900'}>
                    {product.stock_current < 10 && <AlertTriangle size={14} />}
                    {product.stock_current.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">S/. {product.average_cost.toFixed(4)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-800">
                  S/. {(product.stock_current * product.average_cost).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products?.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <PackageCheck className="mx-auto h-12 w-12 text-gray-300 mb-2" />
            <p>No hay productos registrados en este programa.</p>
          </div>
        )}
      </div>
    </div>
  );
};
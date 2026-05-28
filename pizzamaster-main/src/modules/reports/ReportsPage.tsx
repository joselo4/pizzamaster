import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../core/api/supabase';
import { useProgram } from '../../core/context/ProgramContext';
import * as XLSX from 'xlsx';
import { notifySuccess, notifyError } from '../../core/utils/notify';
import { FileText, Download, Loader2, Users, Package, ArrowRightLeft } from 'lucide-react';

export const ReportsPage = () => {
  const { programId, program } = useProgram();
  const [loading, setLoading] = useState<string | null>(null);

  // ACCESOS RÁPIDOS MVP


// 4. RESPALDO COMPLETO (múltiples hojas)
const downloadBackup = async () => {
  setLoading('BACKUP');
  try {
    const tables = ['products','batches','movements','centers','patients','ration_rules','kit_rules','app_settings','audit_logs'];
    const wb = XLSX.utils.book_new();
    for (const t of tables) {
      try {
        const { data } = await supabase.from(t).select('*').eq('program_id', programId);
        const ws = XLSX.utils.json_to_sheet(data || []);
        XLSX.utils.book_append_sheet(wb, ws, t.substring(0,31));
      } catch (e) {
        // ignore table errors
      }
    }
    const file = `Respaldo_${program}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, file);
    notifySuccess('Respaldo generado.');
  } catch (e:any) {
    notifyError(e);
  } finally { setLoading(null); }
};


  // 1. REPORTE DE PADRÓN (Beneficiarios o Centros)
  const downloadPadron = async () => {
    setLoading('PADRON');
    try {
      let data = [];
      let filename = '';

      if (program === 'PANTBC') {
        const { data: res } = await supabase.from('patients').select('*').eq('program_id', programId);
        data = res || [];
        filename = `Padron_Pacientes_${program}_${new Date().toISOString().split('T')[0]}`;
      } else {
        const { data: res } = await supabase.from('centers').select('*').eq('program_id', programId);
        data = res || [];
        filename = `Padron_Centros_${program}_${new Date().toISOString().split('T')[0]}`;
      }

      if (data.length === 0) return // alert replaced with toast
// alert('No hay datos para exportar.');

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Padron");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } catch (e: any) {
      // alert replaced with toast
// alert('Error: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  // 2. REPORTE DE INVENTARIO VALORIZADO
  const downloadInventory = async () => {
    setLoading('INVENTORY');
    try {
      const { data } = await supabase.from('products').select('*').eq('program_id', programId);
      if (!data || data.length === 0) return // alert replaced with toast
// alert('El inventario está vacío.');

      const formatted = data.map((p: any) => ({
        PRODUCTO: p.name,
        UNIDAD: p.unit,
        STOCK_ACTUAL: p.stock_current,
        COSTO_PROMEDIO: p.average_cost,
        VALOR_TOTAL: (p.stock_current * p.average_cost).toFixed(2)
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(formatted);
      XLSX.utils.book_append_sheet(wb, ws, "Inventario_Valorizado");
      XLSX.writeFile(wb, `Inventario_${program}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e: any) {
      // alert replaced with toast
// alert('Error: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  // 3. REPORTE DE MOVIMIENTOS (KARDEX GLOBAL)
  const downloadMovements = async () => {
    setLoading('MOVEMENTS');
    try {
      // Obtenemos últimos 1000 movimientos
      const { data } = await supabase
        .from('movements')
        .select('*, products(name), centers(name)')
        .eq('program_id', programId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!data || data.length === 0) return // alert replaced with toast
// alert('No hay movimientos registrados.');

      const formatted = data.map((m: any) => ({
        FECHA: new Date(m.created_at).toLocaleString(),
        TIPO: m.type === 'IN' ? 'ENTRADA' : 'SALIDA',
        PRODUCTO: m.products?.name,
        CANTIDAD: m.quantity,
        DESTINO_PROVEEDOR: m.centers?.name || m.provider_name || '---',
        DOCUMENTO: m.invoice_number || m.pecosa_ref || '---',
        OBSERVACION: m.observation
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(formatted);
      XLSX.utils.book_append_sheet(wb, ws, "Kardex_Global");
      XLSX.writeFile(wb, `Movimientos_${program}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e: any) {
      // alert replaced with toast
// alert('Error: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to="/pecosas" className="bg-white border rounded p-4 hover:bg-gray-50">
          <div className="font-bold text-sm">Libro de PECOSAS (MVP)</div>
          <div className="text-xs text-gray-500">Búsqueda y export. (requiere tabla transactions expuesta)</div>
        </Link>
        <Link to="/closure" className="bg-white border rounded p-4 hover:bg-gray-50">
          <div className="font-bold text-sm">Cierre mensual (Acta)</div>
          <div className="text-xs text-gray-500">PDF imprimible</div>
        </Link>
        <Link to="/health" className="bg-white border rounded p-4 hover:bg-gray-50">
          <div className="font-bold text-sm">Salud del sistema</div>
          <div className="text-xs text-gray-500">Errores y auditoría</div>
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <FileText className="text-blue-600"/> Reportes y Consultas: {program}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* REPORTE 1: PADRÓN */}
        <div onClick={downloadPadron} className="bg-white p-6 rounded shadow hover:shadow-lg transition cursor-pointer border border-gray-100 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><Users size={80}/></div>
            <div className="relative z-10">
                <Users size={40} className="text-blue-600 mb-4"/>
                <h3 className="font-bold text-lg mb-2">Padrón de {program === 'PANTBC' ? 'Pacientes' : 'Beneficiarios'}</h3>
                <p className="text-sm text-gray-500 mb-4">Lista detallada maestra de todos los registrados activos.</p>
                <button disabled={loading === 'PADRON'} className="text-blue-600 font-bold text-sm flex items-center gap-2">
                    {loading === 'PADRON' ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>} 
                    {loading === 'PADRON' ? 'GENERANDO...' : 'DESCARGAR EXCEL'}
                </button>
            </div>
        </div>

        {/* REPORTE 2: INVENTARIO */}
        <div onClick={downloadInventory} className="bg-white p-6 rounded shadow hover:shadow-lg transition cursor-pointer border border-gray-100 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><Package size={80}/></div>
            <div className="relative z-10">
                <Package size={40} className="text-green-600 mb-4"/>
                <h3 className="font-bold text-lg mb-2">Inventario Valorizado</h3>
                <p className="text-sm text-gray-500 mb-4">Stock actual con costos unitarios y valor total en almacén.</p>
                <button disabled={loading === 'INVENTORY'} className="text-green-600 font-bold text-sm flex items-center gap-2">
                    {loading === 'INVENTORY' ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>} 
                    {loading === 'INVENTORY' ? 'GENERANDO...' : 'DESCARGAR EXCEL'}
                </button>
            </div>
        </div>

        {/* REPORTE 3: MOVIMIENTOS */}
        <div onClick={downloadMovements} className="bg-white p-6 rounded shadow hover:shadow-lg transition cursor-pointer border border-gray-100 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><ArrowRightLeft size={80}/></div>
            <div className="relative z-10">
                <ArrowRightLeft size={40} className="text-purple-600 mb-4"/>
                <h3 className="font-bold text-lg mb-2">Movimientos (Kardex)</h3>
                <p className="text-sm text-gray-500 mb-4">Reporte de entradas y salidas (PECOSAS) histórico.</p>
                <button disabled={loading === 'MOVEMENTS'} className="text-purple-600 font-bold text-sm flex items-center gap-2">
                    {loading === 'MOVEMENTS' ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>} 
                    {loading === 'MOVEMENTS' ? 'GENERANDO...' : 'DESCARGAR EXCEL'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
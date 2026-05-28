import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Package, FileText, Settings, LogOut, AlertTriangle, BarChart3, Repeat, Layers } from 'lucide-react';
import { supabase } from '../api/supabase';
import {getProgramLabel, useProgram} from '../context/ProgramContext';
import { usePermissions2 } from '../utils/permissions2';
import { fetchNotices, activeNotices } from '../api/notices';
import { ProgramLogo } from './ProgramLogo';
import { ConnectionIndicator } from './ConnectionIndicator';

interface SidebarProps {
  themeColor?: string;
}

export const Sidebar = ({ themeColor }: SidebarProps) => {
  const { program, programGroup, switchProgram } = useProgram();
  const location = useLocation();
  const { can } = usePermissions2();

  const { data: noticesData } = useQuery({
    queryKey: ['avisos', programGroup],
    queryFn: () => fetchNotices(programGroup),
    staleTime: 30_000,
  });

  const noticesCount = activeNotices(noticesData).length;

  // Colores por programa (distintivo, sin romper)
  const PROGRAM_THEME: Record<string, string> = {
    PCA_COM: 'bg-gradient-to-b from-blue-950 to-blue-800',
    PCA_HOG: 'bg-gradient-to-b from-indigo-950 to-indigo-800',
    PCA_RSK: 'bg-gradient-to-b from-fuchsia-950 to-fuchsia-800',
    PANTBC:  'bg-gradient-to-b from-emerald-950 to-emerald-800',
    OLLAS:   'bg-gradient-to-b from-amber-950 to-orange-800',
    PCA:     'bg-gradient-to-b from-blue-950 to-blue-800',
  };
  const computedTheme = themeColor ?? PROGRAM_THEME[program] ?? 'bg-blue-900';


  const getLinkClass = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
      ? 'bg-white/20 text-white shadow-sm'
      : 'text-white/70 hover:bg-white/10 hover:text-white';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <aside className={`w-64 h-screen fixed left-0 top-0 ${computedTheme} text-white p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <ProgramLogo />
      </div>

      <div className="mt-2">
        <label className="text-[10px] uppercase text-white/70 font-bold">Programa activo</label>
        <select
          value={program}
          onChange={(e) => switchProgram(e.target.value as any)}
          className="w-full bg-black/20 border border-white/10 rounded p-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white/30 cursor-pointer"
        >
          <option value="PCA_COM">PCA-Comedores Populares</option>
          <option value="PCA_HOG">PCA-Hogares y Albergues</option>
          <option value="PCA_RSK">PCA-Personas en Riesgo</option>
          <option value="PANTBC">PANTBC (TBC)</option>
          <option value="OLLAS">Ollas Comunes</option>
        </select>

        <div className="mt-2">
          <ConnectionIndicator />
        </div>
      </div>

      <nav className="mt-3 flex-1 space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 pb-6">
        {can('module:inventory') && (
          <Link to="/inventory" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/inventory')}`}>
            <Package size={18} /> Inventario / Stock
          </Link>
        )}

        {can('module:distribution') && (
          <Link
            to="/distribution"
            className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/distribution')}`}
          >
            <Users size={18} /> Distribución
          </Link>
        )}

        {can('module:directory') && (
          <Link to="/centers" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/centers')}`}>
            <Users size={18} /> {programGroup === 'OLLAS' ? 'Ollas / Usuarios' : programGroup === 'PANTBC' ? 'Pacientes' : 'Centros / Benef.'}
          </Link>
        )}

        {can('module:notices') && (
          <Link to="/notices" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/notices')}`}>
            <AlertTriangle size={18} /> Avisos
            {noticesCount > 0 && (
              <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded font-black">{noticesCount}</span>
            )}
          </Link>
        )}

        {can('module:reports') && (
          <Link to="/reports" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/reports')}`}>
            <FileText size={18} /> Reportes
          </Link>
        )}

        {can('module:summary') && (
          <Link to="/summary" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/summary')}`}>
            <BarChart3 size={18} /> Resumen KPIs
          </Link>
        )}

        {can('health:view') && (
          <Link to="/health" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/health')}`}>
            <AlertTriangle size={18} /> Salud
          </Link>
        )}

        {can('module:settings') && (
          <Link to="/settings" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/settings')}`}>
            <Settings size={18} /> Configuración
          </Link>
        )}
      
        {can('module:globalstock') && (
          <Link to="/global-stock" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/global-stock')}`}>
            <Layers size={18} /> Stock General
          </Link>
        )}

        {can('module:transfer') && (
          <Link to="/transfer" className={`flex items-center gap-2 px-3 py-2 rounded ${getLinkClass('/transfer')}`}>
            <Repeat size={18} /> Transferencias / Préstamos
          </Link>
        )}
</nav>

      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-2 px-3 py-2 rounded bg-black/20 hover:bg-white/10"
      >
        <LogOut size={18} /> Cerrar sesión
      </button>
    </aside>
  );
};

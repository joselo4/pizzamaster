import { useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// CORRECCIÓN: Se eliminó 'Menu' de los imports porque no se usa
import { LayoutDashboard, ShoppingCart, ChefHat, Bike, DollarSign, ClipboardCheck, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function MobileLayout() {
  const { user, logout, badges } = useAuth();
  const location = useLocation();
  const path = location.pathname.replace('/', '');
  const isAdmin = user?.role === 'Admin';

  // Efecto para cargar Icono y Título del navegador desde Config
  useEffect(() => {
    const updateAppIdentity = async () => {
        const { data } = await supabase.from('config').select('*');
        if (data) {
            const c: any = {};
            data.forEach((r:any) => c[r.key] = r.text_value);
            
            if (c.nombre_tienda) document.title = c.nombre_tienda;
            
            if (c.logo_url) {
                let link: any = document.querySelector("link[rel~='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = c.logo_url;
            }
        }
    };
    updateAppIdentity();
  }, []);

  const isActive = (p: string) => path === p || (path === '' && p === 'pos');

  return (
    <div className="flex flex-col h-[100dvh] bg-dark">
      {/* Header */}
      <div className="bg-card border-b border-gray-800 p-3 flex justify-between items-center z-20 shadow-md shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg">
               <span className="text-xs">PZ</span>
            </div>
            <div>
                <h1 className="font-black text-white leading-none text-lg">Pizzería</h1>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex gap-1">
                    <span>{user?.username}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-orange-500">{user?.role}</span>
                </div>
            </div>
        </div>
        <button onClick={logout} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <LogOut size={18} />
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative w-full max-w-7xl mx-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-card border-t border-gray-800 pb-safe shrink-0 z-20">
        <div className="flex justify-around items-center h-16">
            
            {(isAdmin || !user?.permissions || user.permissions.includes('access_pos')) && (
                <Link to="/pos" className={`flex flex-col items-center gap-1 w-full h-full justify-center ${isActive('pos') ? 'text-orange-500' : 'text-gray-500'}`}>
                    <ShoppingCart size={20} className={isActive('pos') ? 'fill-current' : ''} />
                    <span className="text-[10px] font-bold">Pedido</span>
                </Link>
            )}

{(isAdmin || user?.permissions?.includes('access_validation')) && (
    <Link to="/validacion" className={`flex flex-col items-center gap-1 w-full h-full justify-center relative ${isActive('validacion') ? 'text-orange-500' : 'text-gray-500'}`}>
        <div className="relative">
            <ClipboardCheck size={20} className={isActive('validacion') ? 'fill-current' : ''} />
            {badges.validation > 0 && <span className="absolute -top-2 -right-3 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border border-dark">{badges.validation}</span>}
        </div>
        <span className="text-[10px] font-bold">Validación</span>
    </Link>
)}


            {(isAdmin || !user?.permissions || user.permissions.includes('access_kitchen')) && (
                <Link to="/kitchen" className={`flex flex-col items-center gap-1 w-full h-full justify-center relative ${isActive('kitchen') ? 'text-orange-500' : 'text-gray-500'}`}>
                    <div className="relative">
                        <ChefHat size={20} className={isActive('kitchen') ? 'fill-current' : ''} />
                        {badges.kitchen > 0 && <span className="absolute -top-2 -right-3 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border border-dark">{badges.kitchen}</span>}
                    </div>
                    <span className="text-[10px] font-bold">Cocina</span>
                </Link>
            )}

            {(isAdmin || !user?.permissions || user.permissions.includes('access_delivery')) && (
                <Link to="/delivery" className={`flex flex-col items-center gap-1 w-full h-full justify-center relative ${isActive('delivery') ? 'text-blue-500' : 'text-gray-500'}`}>
                    <div className="relative">
                        <Bike size={22} className={isActive('delivery') ? 'fill-current' : ''} />
                        {badges.delivery > 0 && <span className="absolute -top-2 -right-3 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border border-dark">{badges.delivery}</span>}
                    </div>
                    <span className="text-[10px] font-bold">Reparto</span>
                </Link>
            )}

            {(isAdmin || !user?.permissions || user.permissions.includes('access_cashier')) && (
                <Link to="/cashier" className={`flex flex-col items-center gap-1 w-full h-full justify-center relative ${isActive('cashier') ? 'text-green-500' : 'text-gray-500'}`}>
                    <div className="relative">
                        <DollarSign size={20} className={isActive('cashier') ? 'fill-current' : ''} />
                        {badges.cashier > 0 && <span className="absolute -top-2 -right-3 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border border-dark">{badges.cashier}</span>}
                    </div>
                    <span className="text-[10px] font-bold">Caja</span>
                </Link>
            )}

            {(isAdmin || !user?.permissions || user.permissions.includes('access_admin')) && (
                <Link to="/admin" className={`flex flex-col items-center gap-1 w-full h-full justify-center ${isActive('admin') ? 'text-purple-500' : 'text-gray-500'}`}>
                    <LayoutDashboard size={20} className={isActive('admin') ? 'fill-current' : ''} />
                    <span className="text-[10px] font-bold">Admin</span>
                </Link>
            )}
        </div>
      </nav>
    </div>
  );
}

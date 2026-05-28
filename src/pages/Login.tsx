import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Pizza, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estado para el Branding del Login
  const [branding, setBranding] = useState<{name?: string, logo?: string}>({});

  useEffect(() => {
    // Cargar logo y nombre apenas se abre el login
    supabase.from('config').select('*').then(({ data }) => {
        if (data) {
            const c: any = {};
            data.forEach((r: any) => c[r.key] = r.text_value);
            setBranding({ name: c.nombre_tienda, logo: c.logo_url });
        }
    });
  }, []);

  

const getLandingAfterLogin = () => {
  try {
    const stored = localStorage.getItem('pizza_session');
    if (!stored) return '/pos';
    const { user: u } = JSON.parse(stored);
    const p: string[] = u?.permissions || [];
    if (u?.role === 'Admin') return '/validacion';
    if (p.includes('access_validation')) return '/validacion';
    if (p.includes('access_pos')) return '/pos';
    if (p.includes('access_cashier')) return '/cashier';
    if (p.includes('access_kitchen')) return '/kitchen';
    if (p.includes('access_delivery')) return '/delivery';
    if (p.includes('access_admin')) return '/admin';
    return '/pos';
  } catch {
    return '/pos';
  }
};

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Pequeño delay artificial para UX
    await new Promise(r => setTimeout(r, 500));
    
    const success = await login(username, pin, true); // true para recordar sesión
    if (success) {
      navigate(getLandingAfterLogin());
    } else {
      setError('Credenciales incorrectas');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6 relative overflow-hidden text-white">
      {/* Fondo decorativo sutil con resplandores neon */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] bg-orange-500 w-96 h-96 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] bg-rose-600 w-96 h-96 rounded-full blur-[120px] animate-pulse"></div>
      </div>

      <div className="w-full max-w-md bg-[#1E1E1E]/80 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-[0_22px_70px_rgba(0,0,0,0.8)] p-8 z-10 animate-in fade-in zoom-in duration-300">
        
        <div className="flex flex-col items-center mb-8">
          {branding.logo ? (
              <img src={branding.logo} alt="Logo" className="h-28 object-contain mb-4 drop-shadow-[0_10px_20px_rgba(249,115,22,0.3)] animate-float" />
          ) : (
              <div className="bg-gradient-to-tr from-orange-500 to-amber-500 p-4 rounded-3xl shadow-lg mb-4 animate-float">
                <Pizza size={44} className="text-white animate-pulse" />
              </div>
          )}
          <h1 className="text-3xl font-black text-white tracking-tight text-center uppercase">
            {branding.name || 'PIZZERÍA'}
          </h1>
          <div className="mt-1 flex items-center gap-1.5 text-orange-400 font-bold uppercase tracking-[0.2em] text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Consola de Operadores</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Usuario</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-white pl-11 pr-4 py-3.5 rounded-2xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all duration-200"
                placeholder="Ej. Mozo1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Pin de Acceso</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
              <input 
                type="password" 
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-white pl-11 pr-4 py-3.5 rounded-2xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all duration-200 font-mono tracking-widest text-lg"
                placeholder="••••"
                maxLength={4}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3.5 rounded-2xl text-center font-extrabold animate-bounce">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-450 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-[0_0_24px_rgba(249,115,22,0.4)] transition-all duration-200 transform active:scale-95 flex items-center justify-center gap-2 h-14"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'INICIAR TURNO 🍕'}
          </button>
        </form>
      </div>
      
      <div className="mt-8 text-center text-gray-600 text-xs font-mono">
        v2.6.1 Stable version • {new Date().getFullYear()}
      </div>
    </div>
  );
}
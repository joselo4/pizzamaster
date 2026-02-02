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
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Fondo decorativo sutil */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 bg-orange-600 w-64 h-64 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-10 right-10 bg-blue-600 w-64 h-64 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-sm bg-card/80 backdrop-blur-md border border-gray-800 rounded-2xl shadow-2xl p-8 z-10 animate-in fade-in zoom-in duration-300">
        
        <div className="flex flex-col items-center mb-8">
          {branding.logo ? (
              <img src={branding.logo} alt="Logo" className="h-24 object-contain mb-4 drop-shadow-lg" />
          ) : (
              <div className="bg-orange-600 p-4 rounded-full shadow-lg mb-4">
                <Pizza size={40} className="text-white animate-pulse" />
              </div>
          )}
          <h1 className="text-2xl font-black text-white tracking-tight text-center">
            {branding.name || 'PIZZERÍA'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Acceso</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Usuario</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-dark/50 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                placeholder="Ej. Mozo1"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">CONTRASEÑA</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type="password" 
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-dark/50 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all font-mono tracking-widest text-lg"
                placeholder="••••••••••"
                maxLength={4}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center font-bold">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold py-3.5 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'INICIAR TURNO'}
          </button>
        </form>
      </div>
      
      <div className="mt-8 text-center text-gray-600 text-xs font-mono">
        v2.6.1 Stable version • {new Date().getFullYear()}
      </div>
    </div>
  );
}
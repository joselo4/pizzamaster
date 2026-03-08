import { useState } from 'react';
import { supabase } from '../../core/api/supabase';
import { Truck, Lock } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = String((error as any)?.message || 'Credenciales incorrectas');
      alert('Error: ' + msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-center mb-6 text-blue-900">
          <Truck size={64} />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Sistema Municipal</h2>
        <p className="text-center text-gray-500 mb-8">Gestión de PCA y PANTBC</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Correo Institucional</label>
            <input 
              type="email" required
              className="w-full border p-3 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="admin@muniandahuaylas.gob.pe"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
            <input 
              type="password" required
              className="w-full border p-3 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-900 text-white p-3 rounded font-bold hover:bg-blue-800 transition flex justify-center gap-2"
          >
            {loading ? 'Validando...' : <><Lock size={20} /> Iniciar Sesión</>}
          </button>
        </form>
        <p className="mt-6 text-xs text-center text-gray-400">
          MUNICIPALIDAD PROVINCIAL DE ANDAHUAYLAS © 2026
        </p>
      </div>
    </div>
  );
};
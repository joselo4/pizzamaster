import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, logAction } from '../lib/supabase';
import { type User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, pin: string, remember: boolean) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  badges: { kitchen: number; delivery: number; cashier: number };
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [badges, setBadges] = useState({ kitchen: 0, delivery: 0, cashier: 0 });

  useEffect(() => {
    const stored = localStorage.getItem('pizza_session');
    if (stored) {
      try {
        const { user: u, expiry } = JSON.parse(stored);
        // Validación de expiración
        if (expiry && new Date().getTime() > expiry) {
            localStorage.removeItem('pizza_session');
        } else {
            setUser(u);
        }
      } catch (e) {
        localStorage.removeItem('pizza_session');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listener en tiempo real para badges (optimizado)
    const fetchCounts = async () => {
      const { count: kitchen } = await supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['Pendiente', 'Horno']);
      const { count: delivery } = await supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['Listo', 'En Transporte']);
      const { count: cashier } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('payment_status', 'Pendiente').neq('status', 'Cancelado');
      
      setBadges({ kitchen: kitchen || 0, delivery: delivery || 0, cashier: cashier || 0 });
    };

    fetchCounts();
    const sub = supabase.channel('global_counts').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchCounts).subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [user]);


  const login = async (username: string, pin: string, remember: boolean) => {
    try {
        // Consultamos usuario por nombre y PIN
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('pin', pin) // Nota: Idealmente esto debería ser una llamada RPC (función backend) para no enviar el PIN plano
            .eq('active', true)
            .single();

        if (error || !data) return false;

        // SEGURIDAD: Eliminamos el PIN del objeto antes de guardarlo en estado o local
        const safeUser = { ...data };
        delete (safeUser as any).pin; 

        setUser(safeUser);
        
        const expiry = remember ? new Date().getTime() + (30 * 24 * 60 * 60 * 1000) : null; // 30 días
        localStorage.setItem('pizza_session', JSON.stringify({ user: safeUser, expiry }));
        
        logAction(safeUser.username, 'LOGIN', 'Inicio de sesión exitoso');
        return true;
    } catch (err) {
        console.error("Login error", err);
        return false;
    }
  };

  const logout = () => {
    if (user) logAction(user.username, 'LOGOUT', 'Cierre de sesión');
    setUser(null);
    localStorage.removeItem('pizza_session');
  };

  return <AuthContext.Provider value={{ user, login, logout, isLoading, badges }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
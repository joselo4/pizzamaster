import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, logAction, setSessionToken } from '../lib/supabase';
import { type User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, pin: string, remember: boolean) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  badges: { kitchen: number; delivery: number; cashier: number; validation: number };
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [badges, setBadges] = useState({ kitchen: 0, delivery: 0, cashier: 0, validation: 0 });

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
          if ((u as any)?.session_token) setSessionToken((u as any).session_token);
        }
      } catch (e) {
        localStorage.removeItem('pizza_session');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
  if (!user) return;

  let alive = true;
  let poll: any = null;

  const fetchCounts = async () => {
    try {
      const [kRes, dRes, cRes, vRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['Pendiente', 'Horno']),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['Listo', 'En Transporte']),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('payment_status', 'Pendiente').neq('status', 'Cancelado'),
        supabase.from('order_requests').select('*', { count: 'exact', head: true }).in('status', ['Nuevo', 'En Revisión', 'Observado']),
      ]);

      if (!alive) return;
      setBadges({
        kitchen: kRes.count || 0,
        delivery: dRes.count || 0,
        cashier: cRes.count || 0,
        validation: vRes.count || 0,
      });
    } catch {
      // No romper UI
    }
  };

  const startPolling = () => {
    if (poll) return;
    poll = window.setInterval(fetchCounts, 8000);
  };

  fetchCounts();

  const chOrders = supabase
    .channel('badge_orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchCounts)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        startPolling();
      }
    });

  const chReq = supabase
    .channel('badge_order_requests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, fetchCounts)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        startPolling();
      }
    });

  const watchdog = window.setTimeout(() => startPolling(), 3000);

  return () => {
    alive = false;
    window.clearTimeout(watchdog);
    if (poll) clearInterval(poll);
    try { supabase.removeChannel(chOrders); } catch {}
    try { supabase.removeChannel(chReq); } catch {}
  };
}, [user]);


  
const login = async (username: string, pin: string, remember: boolean) => {
  try {
    const { data, error } = await supabase.rpc('rpc_login', {
      p_username: username,
      p_pin: pin,
      p_ip: null,
    });

    if (error || !data?.ok) return false;

    const safeUser = data.user as any;
    if (data.session_token) {
      safeUser.session_token = data.session_token;
      safeUser.session_expires_at = data.expires_at;
      setSessionToken(data.session_token);
    }

    setUser(safeUser);

    const expiry = remember ? new Date().getTime() + (30 * 24 * 60 * 60 * 1000) : null;
    localStorage.setItem('pizza_session', JSON.stringify({ user: safeUser, expiry }));

    await logAction(safeUser.username, 'LOGIN', 'Inicio de sesión exitoso');
    return true;
  } catch (err) {
    console.error('Login error', err);
    return false;
  }
};

const logout = () => {
    try {
      supabase.rpc('rpc_logout');
    } catch { /* ignore */ }

    if (user) logAction(user.username, 'LOGOUT', 'Cierre de sesión');
    setUser(null);
    setSessionToken(undefined);
    localStorage.removeItem('pizza_session');
  };

  return <AuthContext.Provider value={{ user, login, logout, isLoading, badges }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
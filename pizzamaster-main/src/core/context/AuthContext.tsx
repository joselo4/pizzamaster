import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabase';
import { Session } from '@supabase/supabase-js';
import { setTelemetryContext } from '../services/telemetry';

interface AuthContextType {
  session: Session | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

    const isInvalidRefresh = (e: any) => {
      const msg = String(e?.message ?? e ?? '');
      return msg.includes('Invalid Refresh Token') || msg.includes('Refresh Token Not Found');
    };
  
    const hardClearAuthStorage = () => {
      try {
        for (const k of Object.keys(window.localStorage || {})) {
          if (k.startsWith('sb-') || k.includes('supabase') || k.includes('auth-token')) {
            try { window.localStorage.removeItem(k); } catch {}
          }
        }
      } catch {}
    };


  useEffect(() => {
  let mounted = true;

  const init = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error && isInvalidRefresh(error)) {
        try { await supabase.auth.signOut(); } catch {}
        hardClearAuthStorage();
        if (mounted) {
          setSession(null);
          setRole(null);
          setLoading(false);
        }
        try { window.location.hash = '#/'; } catch {}
        try { window.location.reload(); } catch {}
        return;
      }

      const s = data?.session ?? null;
      if (!mounted) return;
      setSession(s);
      try { setTelemetryContext({ user_email: s?.user?.email || null }); } catch {}
      if (s?.user?.id) {
        fetchRole(s.user.id);
        updateLastSeen(s.user.id, s.user.email);
      } else {
        setRole(null);
        setLoading(false);
      }
    } catch (e: any) {
      if (!mounted) return;
      if (isInvalidRefresh(e)) {
        try { await supabase.auth.signOut(); } catch {}
        hardClearAuthStorage();
        try { window.location.hash = '#/'; } catch {}
        try { window.location.reload(); } catch {}
      }
      setSession(null);
      setRole(null);
      setLoading(false);
    }
  };

  init();

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
    if (!mounted) return;
    setSession(s);
    try { setTelemetryContext({ user_email: s?.user?.email || null }); } catch {}

    if (s?.user?.id) {
      fetchRole(s.user.id);
      updateLastSeen(s.user.id, s.user.email);
    } else {
      setRole(null);
      setLoading(false);
      try { window.location.hash = '#/'; } catch {}
    }

    if (event === 'SIGNED_OUT') {
      try { hardClearAuthStorage(); } catch {}
    }
  });

  return () => {
    mounted = false;
    try { subscription.unsubscribe(); } catch {}
  };
}, []);

  

const updateLastSeen = async (userId: string, email?: string | null) => {
  try {
    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId);
    try { setTelemetryContext({ user_email: email || null }); } catch {}
  } catch {
    // best-effort
  }
};

  const fetchRole = async (userId: string) => {
  // Lee rol + estado del usuario desde profiles.
  // Fallback seguro: viewer (solo lectura) si no existe perfil o hay error.
  const { data, error } = await supabase
    .from('profiles')
    .select('role,status')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    setRole('viewer');
    setLoading(false);
    return;
  }

  const status = String(data.status ?? 'ACTIVE').toUpperCase();
  if (status === 'SUSPENDED' || status === 'BLOCKED') {
    try {
      await supabase.auth.signOut();
    } catch {
      // best-effort
    }
    setRole(null);
    setSession(null);
    setLoading(false);
    return;
  }

  setRole((data.role as any) ?? 'viewer');
  setLoading(false);
};

  const signOut = async () => {
    try { await supabase.auth.signOut(); } finally {
      try { hardClearAuthStorage(); } catch {}
      setSession(null);
      setRole(null);
      setLoading(false);
      try { window.location.hash = '#/'; } catch {}
      try { window.location.reload(); } catch {}
    }
  };

  return (
    <AuthContext.Provider value={{ session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
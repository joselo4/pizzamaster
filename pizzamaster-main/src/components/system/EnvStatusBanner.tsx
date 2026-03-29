import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { SUPABASE_ENV_STATE } from '../../lib/supabase';

export default function EnvStatusBanner() {
  if (SUPABASE_ENV_STATE.isConfigured) return null;

  return (
    <div className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={18} />
        <div>
          <div className="font-semibold">Supabase no está configurado correctamente.</div>
          <div className="mt-1 text-amber-100/90">
            Completa <code className="rounded bg-black/20 px-1 py-0.5">.env.local</code> con tu URL real y tu anon key real.
            Mientras tanto, la app funciona en modo seguro sin hidratar datos remotos.
          </div>
        </div>
      </div>
    </div>
  );
}

import { supabase } from '../api/supabase';

// Context (best-effort) to enrich audit & error events.
type TelemetryCtx = {
  user_email?: string | null;
  program_id?: string | null;
};

let ctx: TelemetryCtx = { user_email: null, program_id: null };

export function setTelemetryContext(partial: TelemetryCtx) {
  ctx = { ...ctx, ...partial };
}

export function getTelemetryContext(): TelemetryCtx {
  return ctx;
}

// Best-effort client error telemetry
export async function logClientError(type: string, message: string, stack?: string) {
  try {
    await supabase.from('client_errors').insert({
      type,
      message,
      stack,
      created_at: new Date().toISOString(),
    });
  } catch {
    // never block UX
  }
}

import { supabase } from '../api/supabase';

export type TelemetryContext = {
  user_email?: string | null;
  program_id?: string | null;
};

let ctx: TelemetryContext = { user_email: null, program_id: null };

export function setTelemetryContext(partial: TelemetryContext) {
  ctx = { ...ctx, ...partial };
}

export function getTelemetryContext(): TelemetryContext {
  return ctx;
}

export async function logError(type: string, message: string, stack?: string) {
  try {
    await supabase.from('client_errors').insert({
      type,
      message,
      stack,
      created_at: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}

export async function audit(action: string, details: any, observation?: string | null) {
  try {
    const payload: any = {
      action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      observation: observation || null,
      user_email: ctx?.user_email || null,
      program_id: ctx?.program_id || null,
      created_at: new Date().toISOString(),
    };
    await supabase.from('audit_logs').insert(payload);
  } catch {
    // best-effort
  }
}

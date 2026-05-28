
// src/lib/logger.ts
import { supabase } from './supabase';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEvent = {
  level?: LogLevel;
  action: string;
  user_name?: string | null;
  order_id?: number | null;
  meta?: Record<string, any> | null;
};

// Logging unificado (quirúrgico):
// 1) Envía a Supabase vía RPC `rpc_log_event` (si existe).
// 2) En DEV también imprime en consola.
// 3) Si existe `window.Sentry`, captura errores (opcional).
export async function logEvent(evt: LogEvent) {
  const payload = {
    level: evt.level ?? 'info',
    action: evt.action,
    user_name: evt.user_name ?? null,
    order_id: evt.order_id ?? null,
    meta: evt.meta ?? null,
  };

  try {
    // RPC idempotente (si no existe o falla, no rompe UI)
    await supabase.rpc('rpc_log_event', {
      p_level: payload.level,
      p_action: payload.action,
      p_user_name: payload.user_name,
      p_order_id: payload.order_id,
      p_meta: payload.meta as any,
    });
  } catch {
    // ignore
  }

  // Sentry opcional (sin dependencia): si el integrador lo incluyó en index.html
  if (payload.level === 'error') {
    try {
      const S: any = (window as any).Sentry;
      if (S?.captureException) {
        S.captureException(new Error(payload.action), {
          extra: payload.meta || {},
          tags: { action: payload.action },
        });
      }
    } catch {
      // ignore
    }
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[logEvent]', payload);
  }
}

export function installGlobalErrorHandler() {
  if ((window as any).__pizzaLoggerInstalled) return;
  (window as any).__pizzaLoggerInstalled = true;

  window.addEventListener('error', (ev: any) => {
    logEvent({
      level: 'error',
      action: 'window.error',
      meta: { message: ev?.message, file: ev?.filename, line: ev?.lineno, col: ev?.colno },
    });
  });

  window.addEventListener('unhandledrejection', (ev: any) => {
    logEvent({
      level: 'error',
      action: 'window.unhandledrejection',
      meta: { reason: String(ev?.reason ?? '') },
    });
  });
}


import { logError } from '../services/telemetry';

export function initErrorCapture() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    const msg = ev?.message || 'unknown';
    const stack = (ev?.error && (ev.error.stack || ev.error.message)) || undefined;
    console.error('[window.error]', msg);
    logError('error', msg, stack);
  });
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    const reason: any = ev?.reason || {};
    const msg = typeof reason === 'string' ? reason : (reason?.message || 'unhandledrejection');
    const stack = reason?.stack;
    console.error('[unhandledrejection]', msg);
    logError('unhandledrejection', msg, stack);
  });
}

import toast from 'react-hot-toast';
import { logError } from '../services/telemetry';

/**
 * Utilidad centralizada para notificaciones.
 * Evita usar alert() (bloquea el hilo UI y puede causar problemas de foco/click en Electron).
 */
export function notifySuccess(message: string) {
  toast.success(message);
}

export function notifyError(error: unknown, fallbackMessage = 'No se pudo completar la operación.') {
  const msg =
    typeof error === 'string'
      ? error
      : (error as any)?.message || (error as any)?.error_description || fallbackMessage;
  toast.error(msg);

  const stack = typeof error === 'object' ? (error as any)?.stack : undefined;
  logError('handled', msg, stack);
}


// Instala un reemplazo no-bloqueante para alert() usando toast.
// Esto evita pantallas bloqueadas en Electron y garantiza aviso visible.
export function installAlertToToast() {
  try {
    if (typeof window === 'undefined') return;
    (window as any).alert = (msg: any) => {
      try { toast(String(msg ?? '')); } catch {}
    };
  } catch {}
}

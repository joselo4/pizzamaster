import type { SupabaseClient } from '@supabase/supabase-js';

export type ValidationAlertConfig = {
  enabled: boolean;
  soundEnabled: boolean;
  browserEnabled: boolean;
  volume: number;
  soundUrl: string;
  title: string;
  message: string;
  statuses: string[];
};

export const VALIDATION_ALERT_CONFIG_KEYS = {
  enabled: 'validation_notify_enabled',
  soundEnabled: 'validation_sound_enabled',
  browserEnabled: 'validation_browser_enabled',
  volume: 'validation_notify_volume',
  soundUrl: 'validation_sound_url',
  title: 'validation_notify_title',
  message: 'validation_notify_message',
  statuses: 'validation_notify_statuses',
} as const;

export const defaultValidationAlertConfig: ValidationAlertConfig = {
  enabled: true,
  soundEnabled: true,
  browserEnabled: true,
  volume: 0.8,
  soundUrl: '/sounds/validation-alert.wav',
  title: 'Nuevo pedido en validación',
  message: 'Revisa el panel de validación.',
  statuses: ['Nuevo', 'En Revisión', 'Validación'],
};

export function normalizeValidationAlertStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function parseValidationAlertStatuses(value: unknown) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function matchesValidationAlertStatus(status: unknown, config: ValidationAlertConfig) {
  const normalized = normalizeValidationAlertStatus(status);
  if (!normalized) return false;
  return (config.statuses || []).some((item) => normalizeValidationAlertStatus(item) === normalized);
}

export async function loadValidationAlertConfig(supabase: SupabaseClient): Promise<ValidationAlertConfig> {
  const wantedKeys = Object.values(VALIDATION_ALERT_CONFIG_KEYS);
  const { data, error } = await supabase
    .from('config')
    .select('key, text_value, numeric_value')
    .in('key', wantedKeys);

  if (error) return defaultValidationAlertConfig;

  const map = Object.fromEntries((data || []).map((row: any) => [row.key, row]));
  const textValue = (key: string, fallback: string) => map[key]?.text_value ?? fallback;
  const numericValue = (key: string, fallback: number) => {
    const value = map[key]?.numeric_value;
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };
  const boolValue = (key: string, fallback: boolean) => {
    const value = map[key]?.text_value;
    if (value == null) return fallback;
    return String(value).trim().toLowerCase() === 'true';
  };

  return {
    enabled: boolValue(VALIDATION_ALERT_CONFIG_KEYS.enabled, defaultValidationAlertConfig.enabled),
    soundEnabled: boolValue(VALIDATION_ALERT_CONFIG_KEYS.soundEnabled, defaultValidationAlertConfig.soundEnabled),
    browserEnabled: boolValue(VALIDATION_ALERT_CONFIG_KEYS.browserEnabled, defaultValidationAlertConfig.browserEnabled),
    volume: Math.max(0, Math.min(1, numericValue(VALIDATION_ALERT_CONFIG_KEYS.volume, defaultValidationAlertConfig.volume))),
    soundUrl: textValue(VALIDATION_ALERT_CONFIG_KEYS.soundUrl, defaultValidationAlertConfig.soundUrl),
    title: textValue(VALIDATION_ALERT_CONFIG_KEYS.title, defaultValidationAlertConfig.title),
    message: textValue(VALIDATION_ALERT_CONFIG_KEYS.message, defaultValidationAlertConfig.message),
    statuses: parseValidationAlertStatuses(textValue(VALIDATION_ALERT_CONFIG_KEYS.statuses, defaultValidationAlertConfig.statuses.join(','))),
  };
}

export async function triggerValidationAlert(config: ValidationAlertConfig, orderLike?: any) {
  if (!config.enabled) return;

  const orderId = orderLike?.id ?? orderLike?.order_id ?? orderLike?.request_id ?? '';
  const customerName = orderLike?.client_name || orderLike?.customer_name || orderLike?.name || 'Cliente';
  const title = config.title || defaultValidationAlertConfig.title;
  const baseMessage = config.message || defaultValidationAlertConfig.message;
  const body = `${baseMessage}${orderId ? ` #${orderId}` : ''}${customerName ? ` · ${customerName}` : ''}`;

  if (config.soundEnabled) {
    try {
      const audio = new Audio(config.soundUrl || defaultValidationAlertConfig.soundUrl);
      audio.volume = Math.max(0, Math.min(1, Number(config.volume) || defaultValidationAlertConfig.volume));
      await audio.play().catch(() => undefined);
    } catch {
      // ignore audio failure
    }
  }

  if (config.browserEnabled && typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          tag: orderId ? `validation-order-${orderId}` : 'validation-order',
        });
      }
    } catch {
      // ignore notification failure
    }
  }
}

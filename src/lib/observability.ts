// src/lib/observability.ts
import { logEvent } from './logger';

export type BizEventName =
  | 'order_paid'
  | 'ticket_printed'
  | 'cashier.history_view'
  | 'cashier.history_search'
  | 'admin.dashboard.view'
  | 'create_order_request';

export function logBizEvent(action: BizEventName, meta?: Record<string, any>, order_id?: number | null, user_name?: string | null) {
  try {
    void logEvent({ level: 'info', action, order_id: order_id ?? null, user_name: user_name ?? null, meta: meta ?? null });
  } catch {}
}


import { supabase } from './supabase';
import type { CartItem, Order, OrderRequest, ServiceType } from '../types';

export async function fetchConfigMap() {
  const { data } = await supabase.from('config').select('*');
  const c: Record<string, any> = {};
  (data || []).forEach((r: any) => {
    c[r.key] = r.text_value ?? r.numeric_value ?? r.num_value ?? r.number_value ?? r.bool_value ?? r.value ?? r;
  });
  return c;
}



function boolish(v: any): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return ['1', 'true', 'si', 'sí', 'yes', 'on'].includes(s);
}

function normalizeStatusTelegram(v: any): string {
  return String(v ?? '').trim().toLowerCase();
}

async function notifyTelegramValidationRequest(
  request: Partial<OrderRequest> | null | undefined,
  payload?: Partial<{
    customer_name: string;
    phone: string;
    address: string;
    service_type: ServiceType;
    estimated_total: number;
    notes: string;
  }>
) {
  try {
    const cfg = await fetchConfigMap();
    if (!boolish((cfg as any)?.telegram_validation_enabled)) return;

    const currentStatus = String((request as any)?.status ?? 'Nuevo').trim() || 'Nuevo';
    const rawStatuses = String((cfg as any)?.telegram_validation_statuses ?? 'Nuevo,En Revisión,Validación').trim();
    const allowed = rawStatuses
      .split(',')
      .map((x) => normalizeStatusTelegram(x))
      .filter(Boolean);

    if (allowed.length && !allowed.includes(normalizeStatusTelegram(currentStatus))) return;

    const body = {
      source: 'order-request-auto',
      status: currentStatus,
      request_id: Number((request as any)?.id || 0) || undefined,
      order_id: Number((request as any)?.mapped_order_id || 0) || undefined,
      client_name: String((request as any)?.customer_name ?? (payload as any)?.customer_name ?? '').trim() || undefined,
      client_phone: String((request as any)?.phone ?? (payload as any)?.phone ?? '').trim() || undefined,
      client_address: String((request as any)?.address ?? (payload as any)?.address ?? '').trim() || undefined,
      service_type: String((request as any)?.service_type ?? (payload as any)?.service_type ?? '').trim() || undefined,
      total: Number((request as any)?.estimated_total ?? (payload as any)?.estimated_total ?? 0).toFixed(2),
      notes: String((request as any)?.notes ?? (payload as any)?.notes ?? '').trim() || undefined,
      created_at: String((request as any)?.created_at ?? new Date().toISOString()),
      chat_id: String((cfg as any)?.telegram_validation_chat_id ?? '').trim() || undefined,
      template: String((cfg as any)?.telegram_validation_template ?? '').trim() || undefined,
    };

    const { error } = await supabase.functions.invoke('notify-telegram-validation', { body });
    if (error) console.warn('[telegram-validation:auto]', error.message || error);
  } catch (e) {
    console.warn('[telegram-validation:auto:unexpected]', e);
  }
}
export async function createOrderRequest(payload: {
  service_type: ServiceType;
  customer_name?: string;
  phone: string;
  address?: string;
  notes?: string;
  items: CartItem[];
  estimated_total: number;
  delivery_fee: number;
  estimated_minutes?: number;
  public_token?: string;
}) {
  const { data, error } = await supabase.rpc('rpc_create_order_request_public', {
    p_payload: payload,
    p_ip: null
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo crear la solicitud');
  const request = data.request as OrderRequest;
  void notifyTelegramValidationRequest(request, payload);
  return request;
}


export async function listPendingRequests() {
  const { data, error } = await supabase
    .from('order_requests')
    .select('*')
    .in('status', ['Nuevo', 'En Revisión', 'Observado'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as OrderRequest[];
}

export async function setRequestStatus(id: number, patch: Partial<OrderRequest>) {
  const { data, error } = await supabase
    .from('order_requests')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'status')) {
    void notifyTelegramValidationRequest(data as OrderRequest);
  }
  return data as OrderRequest;
}

export async function approveRequestToOrder(params: {
  request: OrderRequest;
  client_name: string;
  client_phone: string;
  client_address?: string;
  items: CartItem[];
  notes?: string;
  total: number;
  delivery_cost: number;
  service_type: ServiceType;
  estimated_minutes?: number;
}) {
  const insertPayload: any = {
    client_name: params.client_name,
    client_phone: params.client_phone,
    client_address: params.client_address || null,
    items: params.items,
    notes: params.notes || '',
    total: params.total,
    delivery_cost: params.delivery_cost,
    status: 'Pendiente',
    service_type: params.service_type,
    payment_method: 'Pendiente',
    payment_status: 'Pendiente',
    pay_on_delivery: params.service_type === 'Delivery',
    pickup_time: null,
    delivery_time: null,
  };

  const { data: orderData, error: orderErr } = await supabase
    .from('orders')
    .insert(insertPayload)
    .select('*')
    .single();

  if (orderErr) throw orderErr;

  await setRequestStatus(params.request.id, {
    status: 'Aprobado',
    mapped_order_id: (orderData as any).id,
    estimated_minutes: params.estimated_minutes ?? params.request.estimated_minutes,
  });

  return orderData as Order;
}

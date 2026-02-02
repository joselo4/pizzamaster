
import { supabase } from './supabase';
import type { CartItem, Order, OrderRequest, ServiceType } from '../types';

export async function fetchConfigMap() {
  const { data } = await supabase.from('config').select('*');
  const c: Record<string, any> = {};
  (data || []).forEach((r: any) => {
    c[r.key] = r.text_value ?? r.num_value ?? r.bool_value ?? r.value ?? r;
  });
  return c;
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
  public_token: string;
}) {
  const { data, error } = await supabase
    .from('order_requests')
    .insert({ status: 'Nuevo', ...payload })
    .select('*')
    .single();

  if (error) throw error;
  return data as OrderRequest;
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

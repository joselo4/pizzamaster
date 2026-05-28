export type OrderStatus = 'Pendiente' | 'Horno' | 'Listo' | 'Recogido' | 'En Transporte' | 'Entregado' | 'Cancelado';
export type ServiceType = 'Local' | 'Delivery';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: number;
  created_at: string;
  client_name: string;
  client_phone: string;
  client_address?: string;
  items: CartItem[];
  notes?: string;
  total: number;
  delivery_cost: number;
  status: OrderStatus;
  service_type: ServiceType;
  table_number?: string; 
  payment_method: string;
  payment_status?: 'Pendiente' | 'Pagado'; 
  final_payment_method?: string;
  pay_on_delivery: boolean;
  delivery_by?: string;
  pickup_time?: string;
  delivery_time?: string;
}

export interface User {
  id: string;
  username: string;
  pin?: string;
  role: string;
  permissions: string[];
  active?: boolean;
  session_token?: string;
  session_expires_at?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  active: boolean;
  sort_index?: number | null;
  is_promo?: boolean;
}

export interface Customer {
  phone: string;
  name: string;
  address: string;
}

export interface TicketSettings {
  // Datos básicos
  business_name?: string;
  business_address?: string;
  business_phone?: string;
  footer_text?: string;
  logo_url?: string;
  paper_width?: '58' | '80';
  
  // Opciones visuales
  show_logo?: boolean;
  show_notes?: boolean;
  show_client?: boolean;
  
  // Redes Sociales y Extras (ACTUALIZADO)
  facebook?: string;
  instagram?: string;
  tiktok?: string; // NUEVO
  wifi_pass?: string;
  website?: string;
  extra_socials?: string; // JSON string para futuras redes
}

// --- Pedidos Web (Cliente sin registro) ---

export type OrderRequestStatus = 'Nuevo' | 'En Revisión' | 'Observado' | 'Aprobado' | 'Rechazado';

export interface OrderRequest {
  id: number;
  created_at: string;
  updated_at?: string;
  status: OrderRequestStatus;
  service_type: ServiceType; // 'Delivery' | 'Local' (Local = Recojo)
  customer_name?: string;
  phone: string;
  address?: string;
  notes?: string;
  items: CartItem[];
  estimated_total: number;
  delivery_fee: number;
  estimated_minutes?: number;
  public_token: string; // uuid
  mapped_order_id?: number | null;
  reject_reason?: string;
}

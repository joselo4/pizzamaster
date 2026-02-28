export type ProgramType = 'PCA' | 'PANTBC';

export interface Product {
  id: number;
  program_id: number;
  name: string;
  unit: string;
  average_cost: number; // Viene como numeric, JS lo trata como number
  stock_current: number;
}

export interface MovementPayload {
  type: 'IN' | 'OUT';
  program_id: number;
  product_id: number;
  quantity: number;
  // Campos condicionales para Compras
  input_unit_cost?: number;
  provider_ruc?: string;
  provider_name?: string;
  invoice_number?: string;
  quality_check?: boolean;
  // Campos condicionales para Salidas
  center_id?: number;
  pecosa_ref?: string;
}

// src/modules/reports/pecosa_export_types.d.ts
export interface PecosaExportRow {
  id: number;
  created_at: string;
  program_id: string | null;
  type: 'IN' | 'OUT' | string | null;
  quantity: number | null;
  pecosa_ref: string | null;
  observation: string | null;
  product_id: number | null;
  product_name: string | null;
  destino_center_id: number | null;
  destino_center_name: string | null;
  patient_id: number | null;
  department: string | null;
  province: string | null;
  district: string | null;
  address: string | null;
  health_center_id: number | null;
  health_center_name: string | null;
}

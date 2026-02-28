import { SupabaseClient } from '@supabase/supabase-js';

export interface PecosaExportRow {
  id: number;
  created_at: string;
  program_id: string | null;
  type: string | null;
  quantity: number | null;
  pecosa_ref: string | null;
  observation: string | null;
  product_id: number | null;
  product_name?: string | null;
  destino_center_id?: number | null;
  destino_center_name?: string | null;
  patient_id?: number | null;
  department?: string | null;
  province?: string | null;
  district?: string | null;
  address?: string | null;
  health_center_id?: number | null;
  health_center_name?: string | null;
  dni?: string | null;
  phone?: string | null;
  ubigeo?: string | null;
}

export async function fetchPecosaRows(
  supabase: SupabaseClient,
  params: { start: string; end: string; programId?: string | null }
): Promise<{ rows: PecosaExportRow[]; source: 'view' | 'transactions' }> {
  const { start, end, programId } = params;
  const endTime = new Date(end); endTime.setHours(23,59,59,999);
  try {
    const q = supabase
      .from('pecosa_export_vw')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', endTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);
    const { data, error } = programId ? q.eq('program_id', programId) : q;
    if (error) throw error;
    return { rows: (data ?? []) as PecosaExportRow[], source: 'view' };
  } catch {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', endTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return { rows: (data ?? []) as any, source: 'transactions' };
  }
}

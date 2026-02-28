import { audit as auditSvc } from '../services/telemetry';

export async function auditLog(action: string, details: string, program_id?: string | number, user_email?: string) {
  // Wrapper backward compatible: centraliza en un solo lugar.
  const meta: any = { text: details, program_id, user_email };
  return auditSvc(action, meta, details);
}

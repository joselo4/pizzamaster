# Parche quirúrgico: Motivo de rechazo en Validación y Track

Este paquete agrega el SQL 20260308_rejection_reason.sql y modifica Track/Validation si los archivos se localizaron.
Si tu pantalla de Validación o Track tiene otro nombre/ruta, aplica el bloque JSX y la lógica indicadas en este README.

## SQL
supabase_sql/20260308_rejection_reason.sql

## Track.tsx (bloque a renderizar cuando status === RECHAZADO):
{data?.status === 'RECHAZADO' && (data as any)?.rejection_reason?.trim() && (
  <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
    <div className="font-semibold">Pedido rechazado</div>
    <div className="mt-1 whitespace-pre-wrap">{(data as any).rejection_reason}</div>
  </div>
)}

## Validation.tsx (estado local y UI):
const [decision, setDecision] = useState('');
const [rejectionReason, setRejectionReason] = useState('');

{decision === 'RECHAZADO' && (
  <div className="mt-4">
    <label className="block text-sm font-medium text-gray-700">Motivo del rechazo</label>
    <textarea className="mt-1 w-full rounded border p-2" rows={3}
      value={rejectionReason}
      onChange={(e)=>setRejectionReason(e.target.value)}
      placeholder="Describe el motivo (obligatorio)"/>
    <div className="mt-2 text-xs text-gray-500">Este motivo se mostrará en /track.</div>
  </div>
)}
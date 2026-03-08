
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useAuth } from '../../../core/context/AuthContext';
import { Plus, Edit, Save, X, Trash2, UserX, UserCheck } from 'lucide-react';
import { usePermissions2 } from '../../../core/utils/permissions2';
import { ImportXlsxModal } from '../../../core/components/ImportXlsxModal';

const REASONS = [
  { key: 'ABANDONO', label: 'Abandono de tratamiento' },
  { key: 'CUMPLIO_TRATAMIENTO', label: 'Cumplió tratamiento' },
  { key: 'YA_NO_SE_REPORTO', label: 'Ya no se reportó' },
  { key: 'OTRO', label: 'Otro' },
];


// Sugerencias para autocompletar (no restringe, solo sugiere)
const REGIONES_SUGERIDAS = [
  'APURIMAC',
  'CUSCO',
  'AYACUCHO',
  'LIMA',
];

const PROVINCIAS_SUGERIDAS = [
  'ANDAHUAYLAS',
  'CHINCHEROS',
  'ABANCAY',
];

// Igual que en Directorio de Centros: lista sugerida
const DISTRITOS_SUGERIDOS = [
  'ANDAHUAYLAS',
  'ANDARAPA',
  'CHIARA',
  'HUANCARAMA',
  'HUANCARAY',
  'HUAYANA',
  'KAQUIABAMBA',
  'KISHUARA',
  'PACOBAMBA',
  'PACUCHA',
  'PAMPA',
  'POMACOCHA',
  'SAN ANTONIO DE CACHI',
  'SAN JERÓNIMO',
  'SAN MIGUEL DE CHACCRAMPA',
  'SANTA MARÍA DE CHICMO',
  'TALAVERA',
  'TUMAY HUARACA',
  'TURPO',
];

const TIPOS_DOCUMENTO_REPORTE = [
  { key: 'OFICIO', label: 'Oficio' },
  { key: 'INFORME', label: 'Informe' },
  { key: 'ACTA', label: 'Acta' },
];

export const PatientsManager = () => {
  const checkDuplicateDni = async (dni: string, currentId?: any) => {
    const d = String(dni||'').trim();
    if (!d) return null;
    const { data } = await supabase.from('patients').select('id,name,dni').eq('dni', d).limit(5);
    const other = (data||[]).find((x:any)=> String(x.id) !== String(currentId||''));
    return other || null;
  };

  const { role, session } = useAuth();
  const { can } = usePermissions2();
  const queryClient = useQueryClient();

  const isViewer = role === 'viewer';
  const canEdit = can('patients:edit') && !isViewer;

  const [isEditing, setIsEditing] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [formData, setFormData] = useState<any>({});

  // Modal baja
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [reasonType, setReasonType] = useState('ABANDONO');
  const [justification, setJustification] = useState('');

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data } = await supabase.from('patients').select('*').order('name');
      return data || [];
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {

if (isViewer) throw new Error('Modo solo lectura');
const normalized = normalizePatient(data);
const payload: any = { ...normalized };
// Evitar intentar actualizar la PK por accidente
if (payload.id) delete payload.id;
if (data.id) {
      const { error } = await supabase.from('patients').update(payload).eq('id', data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('patients').insert(payload);
      if (error) throw error;
    }

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setIsEditing(false);
      setFormData({});
      alert('Paciente guardado.');
    },
    onError: (e: any) => alert('Error: ' + e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('¿Eliminar paciente?')) return;
      await supabase.from('patients').delete().eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] })
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (!canEdit) throw new Error('Sin permiso para desactivar');
      if (!target?.id) throw new Error('Seleccione paciente');
      if (!justification || justification.trim().length < 10) throw new Error('Justificación mínima 10 caracteres');

      const payload:any = {
        status: 'INACTIVO',
        inactive_reason_type: reasonType,
        inactive_justification: justification.trim(),
        inactive_at: new Date().toISOString(),
        inactive_by: session?.user?.id || null,
      };

      const { error } = await supabase.from('patients').update(payload).eq('id', target.id);
      if (error) {
        const msg = String((error as any)?.message || '');
        if (msg.toLowerCase().includes('schema cache')) {
          throw new Error("La API no reconoce aún las columnas de baja. Ejecuta migración 20260125_patients_inactivation_fields.sql y recarga: select pg_notify('pgrst','reload schema');");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowDeactivate(false);
      setTarget(null);
      setJustification('');
      alert('Paciente desactivado.');
    },
    onError: (e:any) => alert('Error: ' + (e?.message || e))
  });

  const reactivateMutation = useMutation({
    mutationFn: async (p:any) => {
      if (!canEdit) throw new Error('Sin permiso para reactivar');
      const { error } = await supabase.from('patients').update({
        status: 'ACTIVO',
        inactive_reason_type: null,
        inactive_justification: null,
        inactive_at: null,
        inactive_by: null,
      }).eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      alert('Paciente reactivado.');
    },
    onError: (e:any) => alert('Error: ' + (e?.message || e))
  });

  

const requiredMissing = (data: any) => {
  const missing: string[] = [];
  const get = (k: string) => String(data?.[k] ?? '').trim();
  if (!get('name')) missing.push('Nombre');
  // DNI se mantiene opcional (según implementación previa)
  if (!get('region')) missing.push('Región');
  if (!get('province')) missing.push('Provincia');
  if (!get('district')) missing.push('Distrito');
  if (!get('health_center')) missing.push('Centro de salud');
  if (!get('report_document_type')) missing.push('Tipo de documento');
  if (!get('report_officio_number')) missing.push('Documento de reporte (N°)');
  return missing;
};

const normalizePatient = (data: any) => {
  const d: any = { ...data };
  if (d?.name) d.name = String(d.name).toUpperCase();
  if (d?.region) d.region = String(d.region).toUpperCase();
  if (d?.province) d.province = String(d.province).toUpperCase();
  if (d?.district) d.district = String(d.district).toUpperCase();
  if (d?.health_center) d.health_center = String(d.health_center).toUpperCase();
  if (!d?.report_document_type) d.report_document_type = 'OFICIO';
  if (d?.report_officio_number) d.report_officio_number = String(d.report_officio_number).trim();
  if (d?.phone) d.phone = String(d.phone).trim();
  if (d?.treatment) d.treatment = String(d.treatment).trim();
  if (d?.address) d.address = String(d.address).trim();
  if (d?.notes) d.notes = String(d.notes).trim();
  return d;
};

const handleSave = () => {
  // Defaults reales (evita que se vea OFICIO pero no exista en formData)
  const next = normalizePatient({
    status: (formData as any)?.status || 'ACTIVO',
    region: (formData as any)?.region || 'APURIMAC',
    province: (formData as any)?.province || 'ANDAHUAYLAS',
    report_document_type: (formData as any)?.report_document_type || 'OFICIO',
    ...formData,
  });

  const missing = requiredMissing(next);
  if (missing.length) {
    alert('Faltan campos obligatorios: ' + missing.join(', '));
    return;
  }
  setFormData(next);
  mutation.mutate(next);
};
return (
    <div className="space-y-6 bg-white p-4 rounded shadow border">
      <div className="flex justify-between items-center border-b pb-4">
        <h3 className="font-bold text-gray-700">Pacientes PANTBC</h3>
        {!isEditing && canEdit && (
          <>
            <button onClick={() => setOpenImport(true)} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-xs mr-2">IMPORTAR</button>
            <button onClick={() => { setIsEditing(true); setFormData({ status: 'ACTIVO', region: 'APURIMAC', province: 'ANDAHUAYLAS', report_document_type: 'OFICIO' }); }} className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm flex gap-2"><Plus size={16}/> NUEVO</button>
          </>
        )}
      </div>

      {isEditing && (
        <div className="bg-blue-50 p-4 rounded border border-blue-200 animate-fade-in mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-blue-800">{formData?.id ? 'Editar' : 'Nuevo'} Paciente</h4>
            <button onClick={() => { setIsEditing(false); setFormData({}); }} className="text-sm text-gray-500 flex gap-1"><X size={16}/> Cancelar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

<div><label className="text-[10px] font-bold text-gray-500">NOMBRE *</label><input className="w-full border p-2 rounded uppercase" value={formData.name || ''} onChange={e=>setFormData({...formData, name: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-gray-500">DNI</label><input className="w-full border p-2 rounded" value={formData.dni || ''} onChange={e=>setFormData({...formData, dni: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-gray-500">ESTADO</label><select className="w-full border p-2 rounded bg-white" value={formData.status || 'ACTIVO'} onChange={e=>setFormData({...formData, status: e.target.value})}><option value="ACTIVO">ACTIVO</option><option value="INACTIVO">INACTIVO</option></select></div>

<div><label className="text-[10px] font-bold text-gray-500">REGIÓN *</label><input list="regiones_sugeridas" className="w-full border p-2 rounded uppercase" value={formData.region || ''} onChange={e=>setFormData({...formData, region: e.target.value})} placeholder="APURIMAC" /></div>
<div><label className="text-[10px] font-bold text-gray-500">PROVINCIA *</label><input list="provincias_sugeridas" className="w-full border p-2 rounded uppercase" value={formData.province || ''} onChange={e=>setFormData({...formData, province: e.target.value})} placeholder="ANDAHUAYLAS" /></div>
<div><label className="text-[10px] font-bold text-gray-500">DISTRITO *</label><input list="distritos_sugeridos" className="w-full border p-2 rounded uppercase" value={formData.district || ''} onChange={e=>setFormData({...formData, district: e.target.value})} placeholder="TALAVERA" /></div>

<div><label className="text-[10px] font-bold text-gray-500">CENTRO DE SALUD *</label><input className="w-full border p-2 rounded uppercase" value={formData.health_center || ''} onChange={e=>setFormData({...formData, health_center: e.target.value})} placeholder="C.S. TALAVERA" /></div>
<div><label className="text-[10px] font-bold text-gray-500">TIPO DE DOCUMENTO *</label><select className="w-full border p-2 rounded bg-white" value={formData.report_document_type || 'OFICIO'} onChange={e=>setFormData({...formData, report_document_type: e.target.value})}>
  {TIPOS_DOCUMENTO_REPORTE.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
</select></div>
<div><label className="text-[10px] font-bold text-gray-500">DOCUMENTO DE REPORTE (N°) *</label><input className="w-full border p-2 rounded" value={formData.report_officio_number || ''} onChange={e=>setFormData({...formData, report_officio_number: e.target.value})} placeholder="N° / código / referencia" /></div>

<div><label className="text-[10px] font-bold text-gray-500">TELÉFONO (opcional)</label><input className="w-full border p-2 rounded" value={formData.phone || ''} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="999999999" /></div>
<div><label className="text-[10px] font-bold text-gray-500">TRATAMIENTO (opcional)</label><input className="w-full border p-2 rounded" value={formData.treatment || ''} onChange={e=>setFormData({...formData, treatment: e.target.value})} placeholder="Esquema / fase" /></div>
<div><label className="text-[10px] font-bold text-gray-500">INICIO TRATAMIENTO (opcional)</label><input type="date" className="w-full border p-2 rounded" value={formData.treatment_start_date || ''} onChange={e=>setFormData({...formData, treatment_start_date: e.target.value})} /></div>

<div className="md:col-span-3"><label className="text-[10px] font-bold text-gray-500">DIRECCIÓN (opcional, personalizable)</label><input className="w-full border p-2 rounded" value={formData.address || ''} onChange={e=>setFormData({...formData, address: e.target.value})} placeholder="Av/Jr, N°, referencia..." /></div>
<div className="md:col-span-3"><label className="text-[10px] font-bold text-gray-500">NOTAS (opcional)</label><textarea className="w-full border p-2 rounded min-h-[70px]" value={formData.notes || ''} onChange={e=>setFormData({...formData, notes: e.target.value})} placeholder="Observaciones..."></textarea></div>

</div>

<datalist id="regiones_sugeridas">
  {REGIONES_SUGERIDAS.map(r => <option key={r} value={r} />)}
</datalist>
<datalist id="provincias_sugeridas">
  {PROVINCIAS_SUGERIDAS.map(p => <option key={p} value={p} />)}
</datalist>
<datalist id="distritos_sugeridos">
  {DISTRITOS_SUGERIDOS.map(d => <option key={d} value={d} />)}
</datalist>
          <div className="flex justify-end mt-3">
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm flex gap-2"><Save size={16}/> GUARDAR</button>
          </div>
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr><th className="p-2">Nombre</th><th className="p-2">DNI</th><th className="p-2">Estado</th><th className="p-2">Acciones</th></tr></thead>
          <tbody>
            {(patients || []).map((p:any)=> (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-bold">{p.name}</td>
                <td className="p-2 text-center">{p.dni || '—'}</td>
                <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded text-xs font-bold ${p.status==='ACTIVO'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{p.status || 'ACTIVO'}</span></td>
                <td className="p-2">
                  <div className="flex gap-2">
                    {canEdit && <button onClick={() => { setIsEditing(true); setFormData({ ...p, status: p?.status || 'ACTIVO', region: p?.region || 'APURIMAC', province: p?.province || 'ANDAHUAYLAS', report_document_type: p?.report_document_type || 'OFICIO' }); }} className="border px-2 py-1 rounded text-xs flex gap-1"><Edit size={14}/> Editar</button>}
                    {canEdit && <button onClick={() => deleteMutation.mutate(p.id)} className="border px-2 py-1 rounded text-xs flex gap-1"><Trash2 size={14}/> Eliminar</button>}
                    {canEdit && (p.status||'ACTIVO')==='ACTIVO' && (
                      <button onClick={() => { setTarget(p); setReasonType('ABANDONO'); setJustification(''); setShowDeactivate(true); }} className="border px-2 py-1 rounded text-xs flex gap-1 text-red-700 border-red-200 bg-red-50"><UserX size={14}/> Desactivar</button>
                    )}
                    {canEdit && (p.status||'ACTIVO')!=='ACTIVO' && (
                      <button onClick={() => reactivateMutation.mutate(p)} className="border px-2 py-1 rounded text-xs flex gap-1"><UserCheck size={14}/> Reactivar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!patients || patients.length===0) && <tr><td className="p-4 text-gray-400" colSpan={4}>Sin pacientes.</td></tr>}
          </tbody>
        </table>
      </div>

      {showDeactivate && target && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded shadow border-t-4 border-red-600 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Desactivar — {target.name}</h3>
              <button onClick={() => setShowDeactivate(false)} className="text-xs font-bold text-gray-500">CERRAR</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500">MOTIVO</label>
                <select value={reasonType} onChange={e=> setReasonType(e.target.value)} className="w-full border p-2 rounded text-sm">
                  {REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500">JUSTIFICACIÓN (obligatoria)</label>
                <textarea value={justification} onChange={e=> setJustification(e.target.value)} className="w-full border p-2 rounded text-sm min-h-[90px]" placeholder="Detalle... (mín. 10 caracteres)" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setShowDeactivate(false)} className="px-4 py-2 text-xs font-bold text-gray-600">CANCELAR</button>
                <button onClick={() => deactivateMutation.mutate()} className="px-5 py-2 rounded bg-red-600 text-white text-xs font-bold">CONFIRMAR</button>
              </div>
            </div>
          </div>
        </div>
      )}

    <ImportXlsxModal
  open={openImport}
  onClose={() => setOpenImport(false)}
  schema={{
      title: 'Importar Pacientes (Excel)',
    hint: 'Columnas recomendadas: name, dni, region, province, district, health_center, report_officio_number.',
    table: 'patients',
      map: {"name": "name", "dni": "dni", "region": "region", "province": "province", "district": "district", "health_center": "health_center", "report_officio_number": "report_officio_number"}
    }}
    onImport={async (rows) => {
    // Solo ADMIN: se espera que el rol base ya limite el acceso a Configuración.
    // Upsert básico (no destructivo)
    const enriched = rows.map((r:any) => ({ ...r, program_id: programId }));
    const { error } = await supabase.from('patients').upsert(enriched);
    if (error) throw error;
    queryClient.invalidateQueries();
  }}
/>

</div>
  );
};
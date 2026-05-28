import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { useAuth } from '../../../core/context/AuthContext'; // Para rol
import { Plus, Edit, User, Save, X, Trash2, MapPin } from 'lucide-react';
import { notifySuccess, notifyError } from '../../../core/utils/notify';
import { ImportXlsxModal } from '../../../core/components/ImportXlsxModal';

const DISTRITOS_SUGERIDOS = ["ANDAHUAYLAS", "ANDARAPA", "CHIARA", "HUANCARAMA", "HUANCARAY", "HUAYANA", "KAQUIABAMBA", "KISHUARA", "PACOBAMBA", "PACUCHA", "PAMPA", "POMACOCHA", "SAN ANTONIO DE CACHI", "SAN JERÓNIMO", "SAN MIGUEL DE CHACCRAMPA", "SANTA MARÍA DE CHICMO", "TALAVERA", "TUMAY HUARACA", "TURPO"];

export const CentersManager = () => {
  const checkDuplicatePresidentDni = async (dni: string, currentId?: any) => {
    const d = String(dni||'').trim();
    if (!d) return null;
    const { data } = await supabase.from('centers').select('id,name,president_dni').eq('president_dni', d).limit(5);
    const other = (data||[]).find((x:any)=> String(x.id) !== String(currentId||''));
    return other || null;
  };

  const { programId, program } = useProgram();
  const { role } = useAuth(); // Obtenemos el rol
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const isViewer = role === 'viewer'; // Check de rol

  const entityName = program === 'PANTBC' ? 'Establecimiento de Salud (CS/PS)' : (program === 'OLLAS' ? 'Olla Común' : 'Comedor / Centro');
  const personName = program === 'PANTBC' ? 'Jefe / Responsable Salud' : (program === 'OLLAS' ? 'Coordinador(a)' : 'Presidente(a)');

  const PROGRAM_BADGE: Record<string, string> = {
    PCA_COM: 'bg-blue-100 text-blue-800',
    PCA_HOG: 'bg-indigo-100 text-indigo-800',
    PCA_RSK: 'bg-purple-100 text-purple-800',
    PANTBC: 'bg-emerald-100 text-emerald-800',
    OLLAS: 'bg-orange-100 text-orange-800',
    PCA: 'bg-blue-100 text-blue-800',
  };

  const fetchCenters = async () => {
    let q: any = supabase.from('centers').select('*').order('name');
    if (!showAllPrograms) q = q.eq('program_id', programId as any);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  };

  const { data: centers } = useQuery({
    queryKey: ['centers', programId, showAllPrograms],
    queryFn: fetchCenters,
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        program_id: programId, 
        name: data.name?.toUpperCase(),
        code: data.code,
        region: data.region?.toUpperCase() || 'APURÍMAC', // Default personalizable
        province: data.province?.toUpperCase() || 'ANDAHUAYLAS',
        district: data.district?.toUpperCase(),
        place: data.place?.toUpperCase(), // Campo nuevo Lugar
        address: data.address?.toUpperCase(),
        president_name: data.president_name?.toUpperCase(),
        president_dni: data.president_dni,
        president_phone: data.president_phone,
        active_beneficiaries: Number(data.active_beneficiaries) || 0,
        resolution_number: data.resolution_number,
        category: program === 'PANTBC' ? 'SALUD' : (program === 'OLLAS' ? 'OLLAS' : 'COMEDOR')
      };

      if (data.id) {
        const { error } = await supabase.from('centers').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('centers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centers', programId] });
      setIsEditing(false); setFormData({});
      notifySuccess('Registro guardado.');
    },
    onError: (err: any) => notifyError('Error: ' + err.message)
  });

  // NUEVO: Función eliminar
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
        if (!confirm('¿Seguro que desea eliminar este centro? Se perderá su historial.')) return;
        const { error } = await supabase.from('centers').delete().eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['centers'] }),
    onError: (e: any) => notifyError('No se pudo eliminar: ' + e.message)
  });

  const handleNew = () => { 
      // Defaults establecidos en Apurimac/Andahuaylas
      setFormData({ region: 'APURÍMAC', province: 'ANDAHUAYLAS', district: 'ANDAHUAYLAS' }); 
      setIsEditing(true); 
  };

  if (isEditing) {
    return (
      <div className="bg-white p-6 rounded shadow max-w-4xl mx-auto border-t-4 border-blue-600 animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{formData.id ? 'Editar' : 'Nuevo'} {entityName}</h3>
          <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="text-[10px] font-bold text-gray-500">NOMBRE {entityName.toUpperCase()}</label><input required className="w-full border p-2 rounded uppercase font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/></div>
            
            {/* NUEVOS CAMPOS DE UBICACIÓN */}
            <div className="bg-gray-50 p-3 rounded border md:col-span-2">
                <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><MapPin size={14}/> UBICACIÓN GEOGRÁFICA</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><label className="text-[9px] font-bold text-gray-400">REGIÓN</label><input className="w-full border p-1 rounded uppercase text-xs" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})}/></div>
                    <div><label className="text-[9px] font-bold text-gray-400">PROVINCIA</label><input className="w-full border p-1 rounded uppercase text-xs" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})}/></div>
                    <div><label className="text-[9px] font-bold text-gray-400">DISTRITO</label><input list="distritos" className="w-full border p-1 rounded uppercase text-xs" value={formData.district || ''} onChange={e => setFormData({...formData, district: e.target.value})}/><datalist id="distritos">{DISTRITOS_SUGERIDOS.map(d => <option key={d} value={d} />)}</datalist></div>
                    <div><label className="text-[9px] font-bold text-gray-400">LUGAR / CC.PP</label><input className="w-full border p-1 rounded uppercase text-xs" value={formData.place || ''} onChange={e => setFormData({...formData, place: e.target.value})}/></div>
                </div>
                <div className="mt-2"><label className="text-[9px] font-bold text-gray-400">DIRECCIÓN EXACTA</label><input className="w-full border p-1 rounded uppercase text-xs" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}/></div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded border md:col-span-2">
                <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><User size={14}/> {personName.toUpperCase()}</h4>
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder="DNI" maxLength={8} className="border p-1.5 rounded w-full text-sm" value={formData.president_dni || ''} onChange={e => setFormData({...formData, president_dni: e.target.value})}/>
                  <input placeholder="Nombre Completo" className="border p-1.5 rounded w-full col-span-2 uppercase text-sm" value={formData.president_name || ''} onChange={e => setFormData({...formData, president_name: e.target.value})}/>
                  <input placeholder="Celular" maxLength={9} className="border p-1.5 rounded w-full text-sm" value={formData.president_phone || ''} onChange={e => setFormData({...formData, president_phone: e.target.value})}/>
                </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-gray-500">{program === 'OLLAS' ? 'USUARIOS ACTIVOS' : 'BENEFICIARIOS ACTIVOS'}</label><input type="number" min="0" className="w-full border p-2 rounded font-bold text-blue-800 text-lg" value={formData.active_beneficiaries || 0} onChange={e => setFormData({...formData, active_beneficiaries: Number(e.target.value)})}/></div>
                <div><label className="text-[10px] font-bold text-gray-500">RESOLUCIÓN (Opcional)</label><input className="w-full border p-2 rounded uppercase text-sm" value={formData.resolution_number || ''} onChange={e => setFormData({...formData, resolution_number: e.target.value})}/></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 text-xs font-bold">CANCELAR</button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-xs flex items-center gap-2"><Save size={14}/> GUARDAR</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-gray-50 p-3 rounded border">
        <div>
          <h2 className="font-bold text-gray-800 text-sm">Padrón de {entityName} ({centers?.length})</h2>
          <div className="mt-2 flex items-center gap-2">
            <input id="allPrograms" type="checkbox" className="accent-blue-900" checked={showAllPrograms} onChange={(e) => setShowAllPrograms(e.target.checked)} />
            <label htmlFor="allPrograms" className="text-[11px] font-bold text-gray-600">Todos los programas</label>
          </div>
        </div>
        {!isViewer && <button onClick={handleNew} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 text-xs font-bold shadow"><Plus size={14} /> NUEVO</button>}
      </div>
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {centers?.map((center) => (
          <div key={center.id} className="bg-white p-3 rounded border shadow-sm hover:shadow-md transition relative group">
            {!isViewer && (
                <div className="absolute top-2 right-2 flex gap-1">
                    <button onClick={() => {setFormData(center); setIsEditing(true)}} className="text-gray-300 hover:text-blue-600 p-1"><Edit size={16} /></button>
                    <button onClick={() => deleteMutation.mutate(center.id)} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                </div>
            )}
            <h3 className="font-bold text-gray-800 text-sm pr-14 truncate">{center.name} <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${PROGRAM_BADGE[String(center.program_id)] ?? 'bg-gray-100 text-gray-700'}`}>{String(center.program_id || '')}</span></h3>
            <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><MapPin size={10}/> {center.district} {center.place ? `- ${center.place}` : ''}</p>
            <div className="mt-2 text-[10px] text-blue-600 flex gap-2">
               <span className="flex items-center gap-1"><User size={10}/> {center.president_name || 'S/N'}</span>
               {center.active_beneficiaries > 0 && <span className="font-bold text-green-700">({center.active_beneficiaries} {(showAllPrograms ? String(center.program_id) : program) === 'OLLAS' ? 'Usuarios' : 'Benef.'})</span>}
            </div>
          </div>
        ))}
      </div>
    <ImportXlsxModal
  open={openImport}
  onClose={() => setOpenImport(false)}
  schema={{
      title: 'Importar Centros (Excel)',
    hint: 'Columnas recomendadas: name, district, president_name, president_dni, president_phone, active_beneficiaries.',
    table: 'centers',
      map: {"name": "name", "district": "district", "president_name": "president_name", "president_dni": "president_dni", "president_phone": "president_phone", "active_beneficiaries": "active_beneficiaries"}
    }}
    onImport={async (rows) => {
    // Solo ADMIN: se espera que el rol base ya limite el acceso a Configuración.
    // Upsert básico (no destructivo)
    const enriched = rows.map((r:any) => ({ ...r, program_id: programId }));
    const { error } = await supabase.from('centers').upsert(enriched);
    if (error) throw error;
    queryClient.invalidateQueries();
  }}
/>

</div>
  );
};
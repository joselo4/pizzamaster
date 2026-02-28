import React, { useState } from 'react';
import { supabase } from '../../core/api/supabase';
import { PatientExtraFields } from '../components/PatientExtraFields';

export default function PatientsNewPatchedExample() {
  const [form, setForm] = useState<any>({
    dni: '', phone: '', ubigeo: '',
    department: '', province: '', district: '', address: '',
    health_center_id: null,
  });
  const save = async () => {
    const payload = {
      dni: form?.dni || null,
      phone: form?.phone || null,
      ubigeo: form?.ubigeo?.toUpperCase?.() || null,
      department: form?.department?.toUpperCase?.() || null,
      province:   form?.province?.toUpperCase?.()   || null,
      district:   form?.district?.toUpperCase?.()   || null,
      address:    form?.address || null,
      health_center_id: form?.health_center_id ? Number(form.health_center_id) : null,
    };
    const { error } = await supabase.from('patients').insert(payload);
    if (error) alert(error.message); else alert('Paciente creado');
  };
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold">Nuevo Paciente (Ejemplo Patcheado)</h2>
      <PatientExtraFields form={form} setForm={setForm} />
      <div className="flex justify-end">
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={save}>Guardar</button>
      </div>
    </div>
  );
}

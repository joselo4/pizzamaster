import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import React from 'react';

type Props = { form: any; setForm: React.Dispatch<React.SetStateAction<any>> };

const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');

export const PatientExtraFields: React.FC<Props> = ({ form, setForm }) => {
  const { programId } = useProgram();
  const { data: centers } = useQuery({
    queryKey: ['centers_min', programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('centers')
        .select('id,name')
        .eq('program_id', programId)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const dni = String(form?.dni ?? '');
  const phone = String(form?.phone ?? '');
  const ubigeo = String(form?.ubigeo ?? '');

  const dniOnChange = (v: string) => {
    const digits = onlyDigits(v).slice(0, 8);
    setForm((f: any) => ({ ...f, dni: digits }));
  };
  const phoneOnChange = (v: string) => {
    const digits = onlyDigits(v).slice(0, 15);
    setForm((f: any) => ({ ...f, phone: digits || null }));
  };
  const ubigeoOnChange = (v: string) => {
    const digits = onlyDigits(v).slice(0, 6);
    setForm((f: any) => ({ ...f, ubigeo: digits || null }));
  };

  const dniInvalid = dni.length > 0 && dni.length !== 8;
  const ubigeoInvalid = ubigeo != null && ubigeo !== '' && ubigeo.length !== 6;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500">DNI</label>
        <input className="w-full border p-2 rounded uppercase" value={dni}
               onChange={e => dniOnChange(e.target.value)} placeholder="8 dígitos" />
        {dniInvalid && <div className="text-[10px] text-red-600 mt-1">DNI debe tener 8 dígitos</div>}
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500">TELÉFONO (opcional)</label>
        <input className="w-full border p-2 rounded" value={phone}
               onChange={e => phoneOnChange(e.target.value)} placeholder="solo dígitos" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500">UBIGEO (opcional)</label>
        <input className="w-full border p-2 rounded uppercase" value={ubigeo || ''}
               onChange={e => ubigeoOnChange(e.target.value)} placeholder="6 dígitos" />
        {ubigeoInvalid && <div className="text-[10px] text-red-600 mt-1">UBIGEO debe tener 6 dígitos</div>}
      </div>

      <div>
        <label className="text-[10px] font-bold text-gray-500">DEPARTAMENTO</label>
        <input className="w-full border p-2 rounded uppercase" value={form?.department ?? ''}
               onChange={e => setForm((f:any)=>({...f, department: e.target.value}))} />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500">PROVINCIA</label>
        <input className="w-full border p-2 rounded uppercase" value={form?.province ?? ''}
               onChange={e => setForm((f:any)=>({...f, province: e.target.value}))} />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500">DISTRITO</label>
        <input className="w-full border p-2 rounded uppercase" value={form?.district ?? ''}
               onChange={e => setForm((f:any)=>({...f, district: e.target.value}))} />
      </div>
      <div className="md:col-span-2">
        <label className="text-[10px] font-bold text-gray-500">DIRECCIÓN</label>
        <input className="w-full border p-2 rounded" value={form?.address ?? ''}
               onChange={e => setForm((f:any)=>({...f, address: e.target.value}))} />
      </div>
      <div className="md:col-span-2">
        <label className="text-[10px] font-bold text-gray-500">CENTRO DE SALUD</label>
        <select className="w-full border p-2 rounded" value={form?.health_center_id ?? ''}
                onChange={e => setForm((f:any)=>({...f, health_center_id: e.target.value || null}))}>
          <option value="">— Seleccione —</option>
          {(centers ?? []).map((c:any)=> (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

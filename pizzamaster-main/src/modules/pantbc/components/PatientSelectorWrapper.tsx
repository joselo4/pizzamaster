import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { KitDelivery } from './KitDelivery';
import { Search, User, ArrowLeft } from 'lucide-react';

export const PatientSelectorWrapper = () => {
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // Buscar Pacientes (Solo muestra si escribes más de 2 letras)
  const { data: results } = useQuery({
    queryKey: ['patient_search', search],
    enabled: search.length > 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('pantbc_patients')
        .select('*, kits(name)')
        .ilike('full_name', `%${search}%`)
        .limit(5);
      return data || [];
    }
  });

  return (
    <div className="space-y-6">
      {!selectedPatient ? (
        <div className="bg-white p-6 rounded shadow-sm border border-gray-200 text-center min-h-[300px]">
           <h3 className="font-bold text-gray-700 mb-4">Buscar Beneficiario PANTBC</h3>
           
           <div className="max-w-md mx-auto relative">
             <Search className="absolute left-3 top-3 text-gray-400"/>
             <input 
               autoFocus
               className="w-full border p-3 pl-10 rounded-lg text-lg shadow-inner outline-none focus:ring-2 focus:ring-blue-500"
               placeholder="Escriba Apellidos o Nombres..."
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
           </div>
           
           <div className="mt-4 space-y-2 max-w-md mx-auto text-left">
             {results?.map((p: any) => (
               <button 
                 key={p.id}
                 onClick={() => setSelectedPatient(p)}
                 className="w-full p-3 hover:bg-blue-50 border rounded-lg flex items-center gap-3 transition bg-white shadow-sm group"
               >
                 <div className="bg-blue-100 p-2 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                    <User size={20}/>
                 </div>
                 <div>
                   <div className="font-bold text-gray-800">{p.full_name}</div>
                   <div className="text-xs text-gray-500 flex gap-2">
                     <span>DNI: {p.dni}</span>
                     <span className="text-blue-600 font-medium">• {p.kits?.name || 'Sin Kit'}</span>
                   </div>
                 </div>
               </button>
             ))}
             {search.length > 2 && results?.length === 0 && (
               <div className="p-4 text-gray-400 bg-gray-50 rounded text-center">No se encontraron pacientes.</div>
             )}
           </div>
        </div>
      ) : (
        <div className="animate-fade-in">
           <button 
             onClick={() => { setSelectedPatient(null); setSearch(''); }}
             className="text-xs font-bold text-blue-600 mb-3 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1 rounded w-fit"
           >
             <ArrowLeft size={14}/> VOLVER AL BUSCADOR
           </button>
           {/* Carga el componente de entrega con el paciente seleccionado */}
           <KitDelivery patient={selectedPatient} />
        </div>
      )}
    </div>
  );
};
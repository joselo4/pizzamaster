import { useState, useEffect } from 'react';
import { supabase } from '../../../core/api/supabase';
import { Save, UserCog, FileSignature } from 'lucide-react';

export const GlobalSettings = () => {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('*');
      const map: any = {};
      data?.forEach((d: any) => map[d.key] = d.value);
      setConfig(map);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    const updates = Object.keys(config).map(key => 
      supabase.from('app_settings').upsert({ key, value: config[key] })
    );
    await Promise.all(updates);
    alert('Configuración guardada correctamente.');
    setLoading(false);
  };

  const handleChange = (key: string, val: string) => setConfig({ ...config, [key]: val });

  return (
    <div className="bg-white p-6 rounded shadow border-l-4 border-gray-800 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg flex items-center gap-2"><UserCog /> Firmas y Responsables (PECOSA)</h3>
        <button onClick={handleSave} disabled={loading} className="bg-blue-900 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 flex items-center gap-2">
          <Save size={18} /> {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4 border p-4 rounded bg-orange-50">
          <h4 className="font-bold text-orange-800 flex items-center gap-2"><FileSignature size={18}/> PCA / OLLAS COMUNES</h4>
          <div><label className="text-[10px] font-bold text-gray-500">SOLICITANTE (RESP. PCA)</label><input className="w-full border p-2 rounded uppercase" value={config['pca_solicitante'] || ''} onChange={e => handleChange('pca_solicitante', e.target.value)} /></div>
          <div><label className="text-[10px] font-bold text-gray-500">SOLICITANTE (RESP. OLLAS)</label><input className="w-full border p-2 rounded uppercase" value={config['ollas_solicitante'] || ''} onChange={e => handleChange('ollas_solicitante', e.target.value)} /></div>
          <div><label className="text-[10px] font-bold text-gray-500">RESP. DISTRIBUCIÓN (ALMACÉN)</label><input className="w-full border p-2 rounded uppercase" value={config['pca_distribuidor'] || ''} onChange={e => handleChange('pca_distribuidor', e.target.value)} /></div>
        </div>

        <div className="space-y-4 border p-4 rounded bg-blue-50">
          <h4 className="font-bold text-blue-800 flex items-center gap-2"><FileSignature size={18}/> PANTBC</h4>
          <div><label className="text-[10px] font-bold text-gray-500">SOLICITANTE (RESP. TBC)</label><input className="w-full border p-2 rounded uppercase" value={config['pantbc_solicitante'] || ''} onChange={e => handleChange('pantbc_solicitante', e.target.value)} /></div>
          <div><label className="text-[10px] font-bold text-gray-500">RESP. DISTRIBUCIÓN (ALMACÉN)</label><input className="w-full border p-2 rounded uppercase" value={config['pantbc_distribuidor'] || ''} onChange={e => handleChange('pantbc_distribuidor', e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
};
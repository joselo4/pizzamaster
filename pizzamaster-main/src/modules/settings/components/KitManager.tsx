import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { notifySuccess, notifyError } from '../../../core/utils/notify';
import { PlusCircle, Save, ChevronRight } from 'lucide-react';

export const KitManager = () => {
  const { programId, program } = useProgram();
  const queryClient = useQueryClient();

  const [activeKitId, setActiveKitId] = useState<number | null>(null);
  const [newKitName, setNewKitName] = useState('CANASTA ESTÁNDAR');
  const [localItems, setLocalItems] = useState<Record<string, string>>({});

  const {
    data: kits,
    error: kitsError,
    isLoading: kitsLoading,
  } = useQuery({
    queryKey: ['kits_list', programId],
    queryFn: async () => {
      const { data, error } = await supabase.from('kits').select('*').eq('program_id', programId).order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (activeKitId == null && (kits || []).length > 0) setActiveKitId((kits as any[])[0].id);
  }, [kits, activeKitId]);

  const {
    data: products,
    error: productsError,
    isLoading: productsLoading,
  } = useQuery({
    queryKey: ['kit_products', activeKitId, programId],
    enabled: !!activeKitId,
    queryFn: async () => {
      const { data: prods, error: pErr } = await supabase.from('products').select('*').eq('program_id', programId).order('name');
      if (pErr) throw pErr;

      const { data: items, error: iErr } = await supabase.from('kit_items').select('product_id, quantity').eq('kit_id', activeKitId);
      if (iErr) throw iErr;

      const map: Record<string, number> = {};
      (items || []).forEach((x: any) => { map[String(x.product_id)] = Number(x.quantity || 0); });

      return (prods || []).map((p: any) => ({ ...p, saved_qty: map[String(p.id)] ?? 0 }));
    },
    staleTime: 10_000,
  });

  // Hydrate local items when products load / kit changes
  useEffect(() => {
    if (!activeKitId) return;
    const next: Record<string, string> = {};
    (products || []).forEach((p: any) => { next[String(p.id)] = String(p.saved_qty ?? 0); });
    setLocalItems(next);
  }, [activeKitId, products]);

  const createKit = async () => {
    try {
      const name = (newKitName || '').trim();
      if (!name) return notifyError('Nombre de canasta es obligatorio');
      const { data, error } = await supabase
        .from('kits')
        .insert({ program_id: programId, name: name.toUpperCase(), created_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      setActiveKitId(data?.id || null);
      setNewKitName('CANASTA ESTÁNDAR');
      await queryClient.invalidateQueries({ queryKey: ['kits_list', programId] });
      notifySuccess('Canasta creada.');
    } catch (e: any) {
      notifyError(e);
    }
  };

  const saveItems = async () => {
    try {
      if (!activeKitId) return notifyError('Seleccione una canasta');

      const itemsToSave: any[] = [];
      (products || []).forEach((p: any) => {
        const valStr = localItems[String(p.id)] ?? String(p.saved_qty ?? 0);
        const val = Number.parseFloat(String(valStr || '0'));
        if (Number.isFinite(val) && val > 0) itemsToSave.push({ kit_id: activeKitId, product_id: p.id, quantity: val });
      });

      const { error: delError } = await supabase.from('kit_items').delete().eq('kit_id', activeKitId);
      if (delError) throw delError;
      if (itemsToSave.length > 0) {
        const { error: insError } = await supabase.from('kit_items').insert(itemsToSave);
        if (insError) throw insError;
      }

      await queryClient.invalidateQueries({ queryKey: ['kit_products', activeKitId, programId] });
      notifySuccess('Canasta guardada.');
    } catch (e: any) {
      notifyError(e);
    }
  };

  const header = useMemo(() => (program === 'PANTBC' ? 'Tipos de Canasta (Kits) — PANTBC' : 'Kits'), [program]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-gray-700">{header}</div>
          <button onClick={createKit} className="text-blue-700 text-xs font-bold flex items-center gap-1">
            <PlusCircle size={14}/> Crear
          </button>
        </div>

        {kitsError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2 mb-2">
            Error cargando kits: {String((kitsError as any)?.message || kitsError)}
          </div>
        )}

        {kitsLoading && <div className="text-xs text-gray-400">Cargando kits...</div>}

        <div className="space-y-2">
          {(kits || []).map((k: any) => (
            <button
              key={k.id}
              onClick={() => setActiveKitId(k.id)}
              className={`w-full flex items-center justify-between text-left px-3 py-2 rounded border text-sm font-bold ${
                activeKitId === k.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {k.name}
              {activeKitId === k.id && <ChevronRight size={16} />}
            </button>
          ))}

          {(kits || []).length === 0 && !kitsLoading && (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs text-gray-400 italic">No hay kits definidos.</p>
              <div className="text-[10px] text-gray-400">Programa actual: <b>{programId}</b></div>
              <input
                className="border rounded px-3 py-2 text-xs w-full"
                value={newKitName}
                onChange={(e) => setNewKitName(e.target.value)}
                placeholder="Nombre de canasta"
              />
              <button onClick={createKit} className="w-full px-3 py-2 bg-blue-600 text-white rounded font-bold text-xs">
                Crear canasta
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-3 bg-white rounded-lg shadow-sm p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-gray-700">Componentes y cantidades</div>
          <button onClick={saveItems} className="px-4 py-2 bg-green-600 text-white rounded font-bold text-xs flex items-center gap-2">
            <Save size={14}/> Guardar
          </button>
        </div>

        {productsError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2 mb-3">
            Error cargando productos: {String((productsError as any)?.message || productsError)}
          </div>
        )}

        {!activeKitId && <div className="p-4 text-center text-gray-400">Seleccione o cree una canasta.</div>}

        {activeKitId && productsLoading && <div className="p-4 text-center text-gray-400">Cargando productos...</div>}

        {activeKitId && !productsLoading && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-2">Producto</th>
                  <th className="p-2 text-center">Unidad</th>
                  <th className="p-2 text-right">Stock</th>
                  <th className="p-2 text-right">Cantidad en canasta</th>
                </tr>
              </thead>
              <tbody>
                {(products || []).map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-bold">{p.name}</td>
                    <td className="p-2 text-center text-xs">{p.unit}</td>
                    <td className="p-2 text-right text-xs">{Number(p.stock_current || 0).toFixed(2)}</td>
                    <td className="p-2 text-right">
                      <input
                        className="border rounded px-2 py-1 text-sm w-28 text-right"
                        value={localItems[String(p.id)] ?? String(p.saved_qty ?? 0)}
                        onChange={(e) => setLocalItems((prev) => ({ ...prev, [String(p.id)]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
                {(products || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-400">
                      No hay productos en este programa (program_id = {programId}).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

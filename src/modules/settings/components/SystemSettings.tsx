import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { ShieldAlert, Trash2, Clock, User, FileText, AlertOctagon, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { UsersManager } from './UsersManager';
import { notifySuccess, notifyError } from '../../../core/utils/notify'; 

export const SystemSettings = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('logs'); 
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [restoreCode, setRestoreCode] = useState('');

  // --- LOGIC: LOGS ---
  const { data: logs } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    }
  });

  // --- HELPER PARA EVITAR EL ERROR DE OBJETO ---
  const renderDetails = (details: any) => {
    if (!details) return '---';
    if (typeof details === 'object') {
      // Si es un objeto (el error que tenías), lo convertimos a texto
      return JSON.stringify(details); 
    }
    return details;
  };

  

// --- BACKUP / RESTORE TOTAL (BD) ---
const downloadBackupFullDb = async () => {
  try {
    const tables = [
      'products','batches','movements','centers','patients',
      'ration_rules','kits','kit_items','transactions','monthly_closures',
      'app_settings','audit_logs','client_errors','user_permissions'
    ];
    const wb = XLSX.utils.book_new();

    const fetchAll = async (t: string) => {
      const out: any[] = [];
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await supabase.from(t).select('*').range(from, from + size - 1);
        if (error) break;
        const rows = data || [];
        out.push(...rows);
        if (rows.length < size) break;
        from += size;
      }
      return out;
    };

    for (const t of tables) {
      try {
        const rows = await fetchAll(t);
        const ws = XLSX.utils.json_to_sheet(rows || []);
        XLSX.utils.book_append_sheet(wb, ws, t.substring(0, 31));
      } catch {
        // ignore
      }
    }

    XLSX.writeFile(wb, `Respaldo_TOTAL_${new Date().toISOString().split('T')[0]}.xlsx`);
    notifySuccess('Respaldo TOTAL generado.');
  } catch (e:any) {
    notifyError(e);
  }
};

const restoreBackupFullDb = async () => {
  if (restoreCode !== 'RESTORE-DATOS') throw new Error('Código incorrecto. Use RESTORE-DATOS.');
  if (!backupFile) throw new Error('Seleccione un archivo .xlsx.');

  const buf = await backupFile.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  const order = [
    'programs','app_settings',
    'products','centers','patients',
    'kits','kit_items','ration_rules',
    'batches','movements','transactions','monthly_closures',
    'user_permissions','audit_logs','client_errors'
  ];

  const toRows = (sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { defval: null }) as any[];
  };

  const upsertChunked = async (table: string, rows: any[]) => {
    const size = 300;
    for (let i = 0; i < rows.length; i += size) {
      const part = rows.slice(i, i + size);
      try {
        const { error } = await supabase.from(table).upsert(part as any, { onConflict: 'id' as any });
        if (error) throw error;
      } catch {
        try { await supabase.from(table).insert(part as any); } catch {}
      }
    }
  };

  for (const t of order) {
    try {
      const rows = toRows(t);
      if (rows.length) await upsertChunked(t, rows);
    } catch {
      // ignore
    }
  }

  notifySuccess('Restauración finalizada.');
  setBackupFile(null);
  setRestoreCode('');
};

const wipeAllData = async () => {
  if (deleteConfirmation !== 'ELIMINAR-DATOS') throw new Error('Código incorrecto. Use ELIMINAR-DATOS.');
  const del = async (t: string) => { try { await supabase.from(t).delete().neq('id', 0 as any); } catch {} };

  await del('movements');
  await del('transactions');
  await del('batches');
  await del('ration_rules');
  await del('kit_items');
  await del('kits');
  await del('patients');
  await del('centers');
  await del('monthly_closures');

  try { await supabase.from('products').update({ stock_current: 0 }).neq('id', 0 as any); } catch {}

  notifySuccess('Datos eliminados (estructura intacta).');
  setDeleteConfirmation('');
};

// --- LOGIC: RESET BD ---

  const resetMutation = useMutation({
    mutationFn: async () => {
        if (deleteConfirmation !== 'ELIMINAR-DATOS') throw new Error("Código de confirmación incorrecto.");
        
        await supabase.from('movements').delete().neq('id', 0);
        await supabase.from('ration_rules').delete().neq('id', 0);
        await supabase.from('products').update({ stock_current: 0 }).neq('id', 0);

        await audit('UI_AUDIT', { 
            action: 'RESET_SISTEMA', 
            details: { text: 'Se eliminaron todos los movimientos y reglas.' }, 
            user_email: 'admin_master',
            program_id: 'SYSTEM'
        }, null);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['movements'] });
        alert("Sistema restablecido correctamente.");
        setDeleteConfirmation('');
    },
    onError: (e:any) => alert(e.message)
  });

  return (
    <div className="space-y-6 animate-fade-in">
        {/* Navegación Tabs */}
        <div className="flex gap-2 border-b">
            <button onClick={()=>setActiveTab('logs')} className={`px-4 py-2 font-bold text-sm ${activeTab==='logs'?'border-b-2 border-blue-600 text-blue-600':'text-gray-500'}`}>LOGS DE AUDITORÍA</button>
            <button onClick={()=>setActiveTab('users')} className={`px-4 py-2 font-bold text-sm ${activeTab==='users'?'border-b-2 border-blue-600 text-blue-600':'text-gray-500'}`}>USUARIOS</button>
            <button onClick={()=>setActiveTab('danger')} className={`px-4 py-2 font-bold text-sm ${activeTab==='danger'?'border-b-2 border-red-600 text-red-600':'text-gray-500'}`}>ZONA DE PELIGRO</button>
        </div>

        {/* TAB: LOGS */}
        {activeTab === 'logs' && (
            <div className="bg-white rounded shadow border overflow-hidden">
                <div className="p-3 bg-gray-50 border-b flex items-center gap-2 font-bold text-gray-700"><ShieldAlert size={18}/> Registro de Acciones y Notas Obligatorias</div>
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-xs uppercase sticky top-0"><tr><th className="p-3">Fecha</th><th className="p-3">Usuario</th><th className="p-3">Acción</th><th className="p-3">Detalle / Nota</th></tr></thead>
                        <tbody className="divide-y">
                            {logs?.map((log:any) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="p-3 text-gray-500 whitespace-nowrap flex items-center gap-2"><Clock size={14}/> {new Date(log.created_at).toLocaleString()}</td>
                                    <td className="p-3 font-bold text-blue-700 flex items-center gap-2"><User size={14}/> {log.user_email || 'Sistema'}</td>
                                    <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">{log.action}</span></td>
                                    {/* AQUI ESTABA EL ERROR: Usamos la función segura */}
                                    <td className="p-3 text-gray-600 flex items-start gap-2 max-w-xs truncate" title={typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}>
                                        <FileText size={14} className="mt-1 shrink-0"/> 
                                        {renderDetails(log.details)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TAB: USUARIOS */}
        {activeTab === 'users' && <UsersManager />}

        {/* TAB: ZONA PELIGRO */}
        {activeTab === 'danger' && (

<>
  <div className="bg-white p-6 rounded shadow border space-y-4">
    <div className="flex items-center gap-2 font-black text-gray-800"><Download size={18}/> Respaldo / Restauración (BD)</div>
    <div className="text-xs text-gray-500">Respaldo/restauración desde el cliente (no incluye usuarios de Auth).</div>
    <button onClick={downloadBackupFullDb} className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-4 py-2 rounded">Descargar Respaldo TOTAL (.xlsx)</button>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <input type="file" accept=".xlsx" onChange={(e)=>setBackupFile(e.target.files?.[0]||null)} />
      <input className="border p-2 rounded" placeholder="Código RESTORE-DATOS" value={restoreCode} onChange={e=>setRestoreCode(e.target.value)} />
    </div>
    <button onClick={() => restoreBackupFullDb().catch((e)=>notifyError(e))} className="bg-indigo-700 hover:bg-indigo-800 text-white font-black px-4 py-2 rounded flex items-center justify-center gap-2">
      <Upload size={18}/> Subir y Restaurar Respaldo
    </button>

    <div className="mt-2 p-4 rounded border border-red-200 bg-red-50 space-y-2">
      <div className="flex items-center gap-2 font-black text-red-700"><AlertOctagon size={18}/> Eliminar datos (mantener estructura)</div>
      <div className="text-xs text-red-700">Borra datos operativos y deja tablas/funciones para que el sistema siga funcionando.</div>
      <input className="border p-2 rounded w-full" placeholder="Escriba ELIMINAR-DATOS" value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} />
      <button onClick={() => wipeAllData().catch((e)=>notifyError(e))} className="bg-red-700 hover:bg-red-800 text-white font-black px-4 py-2 rounded">Eliminar Datos</button>
    </div>
  </div>

            <div className="bg-red-50 border-2 border-red-200 rounded p-6 max-w-2xl mx-auto text-center">
                <AlertOctagon size={48} className="text-red-600 mx-auto mb-4"/>
                <h3 className="text-xl font-bold text-red-700 mb-2">Restablecer Base de Datos</h3>
                <p className="text-gray-600 mb-6 text-sm">
                    Esta acción eliminará <b>TODOS los movimientos y reglas</b>. 
                    <br/>Los usuarios y centros NO se borrarán.
                </p>
                <div className="bg-white p-4 rounded border border-red-200 inline-block text-left w-full max-w-sm">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Escriba: "ELIMINAR-DATOS"</label>
                    <input className="w-full border-2 border-red-300 p-2 rounded font-bold text-center uppercase" 
                        value={deleteConfirmation} 
                        onChange={e=>setDeleteConfirmation(e.target.value)}
                    />
                </div>
                <div className="mt-6">
                    <button onClick={() => resetMutation.mutate()} 
                        disabled={deleteConfirmation !== 'ELIMINAR-DATOS'}
                        className="bg-red-600 text-white px-8 py-3 rounded font-bold hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2 mx-auto shadow-lg">
                        <Trash2 size={20}/> CONFIRMAR RESTABLECIMIENTO
                    </button>
                </div>
            </div>

            </>
        )}
    </div>
  );
};
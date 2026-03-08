import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload } from 'lucide-react';
import { notifyError, notifySuccess } from '../utils/notify';

export type ImportSchema = {
  title: string;
  hint: string;
  table: string;
  map: Record<string, string>; // Excel column -> DB column
  required?: string[];
};

export const ImportXlsxModal = ({
  open,
  onClose,
  schema,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  schema: ImportSchema;
  onImport: (rows: any[]) => Promise<void>;
}) => {
  const [rows, setRows] = useState<any[]>([]);

  const columns = useMemo(() => Object.keys(schema.map || {}), [schema]);

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
      setRows(raw.slice(0, 500));
      notifySuccess(`Cargado: ${raw.length} filas (preview 500).`);
    } catch (e) {
      notifyError(e);
    }
  };

  const normalized = useMemo(() => {
    return (rows || []).map((r) => {
      const out: any = {};
      for (const k of Object.keys(schema.map || {})) {
        out[schema.map[k]] = (r as any)[k];
      }
      return out;
    });
  }, [rows, schema]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded shadow border-t-4 border-emerald-600 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800">{schema.title}</h3>
          <button
            onClick={onClose}
            className="text-xs font-bold text-gray-500 flex items-center gap-1"
          >
            <X size={14} /> CERRAR
          </button>
        </div>

        <p className="text-xs text-gray-600 mb-3">{schema.hint}</p>

        <div className="flex items-center gap-3">
          <label className="px-3 py-2 rounded bg-gray-900 text-white text-xs font-bold cursor-pointer flex items-center gap-2">
            <Upload size={14} /> Seleccionar archivo
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>

          <button
            className="px-3 py-2 rounded bg-emerald-600 text-white text-xs font-bold disabled:bg-gray-300"
            disabled={!normalized.length}
            onClick={async () => {
              try {
                await onImport(normalized);
                notifySuccess('Importación enviada.');
                onClose();
              } catch (e) {
                notifyError(e);
              }
            }}
          >
            Importar ({normalized.length})
          </button>
        </div>

        <div className="mt-4 border rounded overflow-auto max-h-[420px]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="p-2 text-left">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(rows || []).slice(0, 50).map((r, i) => (
                <tr key={i} className={i % 2 ? 'bg-white' : 'bg-gray-50/40'}>
                  {columns.map((c) => (
                    <td key={c} className="p-2">
                      {String((r as any)[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
              {(!rows || rows.length === 0) && (
                <tr>
                  <td className="p-4 text-gray-400" colSpan={columns.length}>
                    Sin preview
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

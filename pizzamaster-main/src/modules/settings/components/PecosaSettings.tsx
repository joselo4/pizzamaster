import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../core/api/supabase';
import { useProgram } from '../../../core/context/ProgramContext';
import { notifyError, notifySuccess } from '../../../core/utils/notify';

const PROGRAMS_FINE = ['PCA_COM','PCA_HOG','PCA_RSK','PANTBC','OLLAS'] as const;
type ProgramFine = typeof PROGRAMS_FINE[number];

const DEFAULT_STYLE = {
  fontFamily: 'courier',
  fontSize: 10,
  headerBold: true,
  titleBold: true,
  lineWidth: 0.35,
};

const DEFAULT_LAYOUT = {
  page: { format: 'a4', unit: 'mm', margin: { top: 12, left: 14 } },
  boxes: {
    header: { x: 14, y: 28, w: 182, h: 25 },
    beneficiary: { x: 14, y: 55, w: 182, h: 30 },
    tableStartY: 90,
    signYGap: 40,
  },
};

function safeParse(v: any) {
  if (!v) return null;
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; }
}

export const PecosaSettings = () => {
  const qc = useQueryClient();
  const { programId } = useProgram();

  const [scope, setScope] = useState<'GLOBAL' | 'PROGRAM'>('GLOBAL');
  const [program, setProgram] = useState<ProgramFine>('PCA_COM');
  const [advanced, setAdvanced] = useState(false);

  const { data: map } = useQuery({
    queryKey: ['app_settings_map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*');
      if (error) throw error;
      const m: any = {};
      (data ?? []).forEach((d: any) => (m[d.key] = d.value));
      return m;
    },
    staleTime: 10_000,
  });

  const keyStyle = useMemo(() => scope === 'GLOBAL' ? 'pecosa_style_global' : `pecosa_style_${program}`, [scope, program]);
  const keyLayout = useMemo(() => scope === 'GLOBAL' ? 'pecosa_layout_global' : `pecosa_layout_${program}`, [scope, program]);

  const [style, setStyle] = useState<any>(DEFAULT_STYLE);
  const [layoutText, setLayoutText] = useState<string>(JSON.stringify(DEFAULT_LAYOUT, null, 2));

  useEffect(() => {
    const s = safeParse(map?.[keyStyle]) ?? DEFAULT_STYLE;
    setStyle({ ...DEFAULT_STYLE, ...s });
    const l = safeParse(map?.[keyLayout]) ?? DEFAULT_LAYOUT;
    setLayoutText(JSON.stringify(l, null, 2));
  }, [map, keyStyle, keyLayout]);

  const save = useMutation({
    mutationFn: async () => {
      const nextStyle = {
        fontFamily: ['courier','helvetica','times'].includes(style.fontFamily) ? style.fontFamily : 'courier',
        fontSize: Math.max(6, Math.min(18, Number(style.fontSize) || 10)),
        headerBold: Boolean(style.headerBold),
        titleBold: Boolean(style.titleBold),
        lineWidth: Math.max(0.1, Math.min(2, Number(style.lineWidth) || 0.35)),
      };
      let nextLayout: any;
      try { nextLayout = JSON.parse(layoutText); } catch { throw new Error('Layout JSON inválido.'); }

      const { error: e1 } = await supabase.from('app_settings').upsert({ key: keyStyle, value: JSON.stringify(nextStyle) }, { onConflict: 'key' });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('app_settings').upsert({ key: keyLayout, value: JSON.stringify(nextLayout) }, { onConflict: 'key' });
      if (e2) throw e2;
    },
    onSuccess: () => {
      notifySuccess('Configuración de PECOSA guardada.');
      qc.invalidateQueries({ queryKey: ['app_settings_map'] });
    },
    onError: (e: any) => notifyError(e, 'No se pudo guardar la configuración de PECOSA.'),
  });

  const reset = () => {
    setStyle(DEFAULT_STYLE);
    setLayoutText(JSON.stringify(DEFAULT_LAYOUT, null, 2));
  };

  return (
    <div className="bg-white p-6 rounded shadow border space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-800">PECOSA — Configuración (Global / Por Programa)</h3>
          <p className="text-xs text-gray-500">Define tipografía, tamaño, negritas y layout de cuadros para todas las PECOSAS. Por defecto aplica global; puedes sobrescribir por programa fino.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={reset} className="px-3 py-2 text-xs font-bold rounded border hover:bg-gray-50">Restaurar</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="px-4 py-2 text-xs font-bold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400">{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-500">ÁMBITO</label>
          <select className="w-full border p-2 rounded" value={scope} onChange={e => setScope(e.target.value as any)}>
            <option value="GLOBAL">Global</option>
            <option value="PROGRAM">Por Programa</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500">PROGRAMA (si aplica)</label>
          <select className="w-full border p-2 rounded" value={program} onChange={e => setProgram(e.target.value as any)} disabled={scope !== 'PROGRAM'}>
            {PROGRAMS_FINE.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Programa actual: <b>{programId}</b></p>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
            <input type="checkbox" checked={advanced} onChange={e => setAdvanced(e.target.checked)} />
            Editar layout (avanzado)
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500">TIPO DE LETRA</label>
            <select className="w-full border p-2 rounded" value={style.fontFamily} onChange={e => setStyle({ ...style, fontFamily: e.target.value })}>
              <option value="courier">Courier</option>
              <option value="helvetica">Helvetica</option>
              <option value="times">Times</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500">TAMAÑO DE LETRA</label>
              <input type="number" className="w-full border p-2 rounded" value={style.fontSize} onChange={e => setStyle({ ...style, fontSize: e.target.value })} min={6} max={18} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">GROSOR DE LÍNEA</label>
              <input type="number" step="0.05" className="w-full border p-2 rounded" value={style.lineWidth} onChange={e => setStyle({ ...style, lineWidth: e.target.value })} min={0.1} max={2} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <input type="checkbox" checked={!!style.titleBold} onChange={e => setStyle({ ...style, titleBold: e.target.checked })} />
              Título en negrita
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <input type="checkbox" checked={!!style.headerBold} onChange={e => setStyle({ ...style, headerBold: e.target.checked })} />
              Encabezados en negrita
            </label>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 border rounded p-3">
            <div><b>Claves:</b></div>
            <div className="break-all">Style: <code>{keyStyle}</code></div>
            <div className="break-all">Layout: <code>{keyLayout}</code></div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500">LAYOUT (JSON)</label>
          <textarea className="w-full border rounded p-2 font-mono text-xs min-h-[320px]" value={layoutText} onChange={e => setLayoutText(e.target.value)} disabled={!advanced} />
          {!advanced && (
            <div className="text-[11px] text-gray-500">Activa “Editar layout (avanzado)” para modificar posiciones de cuadros (x/y/ancho/alto) y tabla.</div>
          )}
        </div>
      </div>
    </div>
  );
};

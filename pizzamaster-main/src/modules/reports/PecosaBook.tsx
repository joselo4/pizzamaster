import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../core/api/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Search, Download, FileText, AlertTriangle, Printer, Eye, Filter } from 'lucide-react';
import { notifyError, notifySuccess } from '../../core/utils/notify';
import { usePermissions2 } from '../../core/utils/permissions2';
import { useAuth } from '../../core/context/AuthContext';



type PrintCfg = {
  fontFamily: 'courier' | 'helvetica' | 'times';
  headerFontSize: number;
  subHeaderFontSize: number;
  bodyFontSize: number;
  tableFontSize: number;
  bold: boolean;
  lineWidth: number;
  cellPadding: number;
  showLot: boolean;
  paper: 'A4' | 'CONTINUO_9_5x11';
};

const DEFAULT_PRINT_CFG: PrintCfg = {
  fontFamily: 'courier',
  headerFontSize: 18,
  subHeaderFontSize: 14,
  bodyFontSize: 12,
  tableFontSize: 11,
  bold: true,
  lineWidth: 1.0,
  cellPadding: 2,
  showLot: true,
  paper: 'CONTINUO_9_5x11',
};

function loadPrintCfg(): PrintCfg {
  try {
    const raw = localStorage.getItem('pecosa_print_cfg_v1');
    if (!raw) return DEFAULT_PRINT_CFG;
    const obj = JSON.parse(raw);
    return { ...DEFAULT_PRINT_CFG, ...(obj || {}) } as PrintCfg;
  } catch {
    return DEFAULT_PRINT_CFG;
  }
}

const fmt = (v: any) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
};

const helpCache = `

SOLUCIÓN (Supabase SQL Editor):
1) Ejecuta grants/policies (migración 20260125_transactions_api_expose.sql)
2) Recarga el schema cache: select pg_notify('pgrst','reload schema');
3) Si persiste: Dashboard → Settings → API → Restart API
`;

function parsePantbcName(text: string) {
  if (!text) return '';
  // Ej: "PANTBC: JUAN PEREZ - ENERO 2026 FECHA:2026-01-..."
  const m = text.match(/PANTBC:\s*([^\-\n\r]+?)(?:\s*\-|\s*FECHA:|$)/i);
  return m?.[1]?.trim() || '';
}

function parseGenericDestino(text: string) {
  if (!text) return '';
  // Si en observación quedó algo tipo "COMEDOR: ...", "OLLA: ...", "DESTINO: ..."
  const m = text.match(/(?:COMEDOR|OLLA|CENTRO|DESTINO)\s*:?\s*([^\n\r;]+)/i);
  return m?.[1]?.trim() || '';
}

export const PecosaBook = () => {
  const { can } = usePermissions2();
  const canView = can('pecosas:view');
  const canEdit = can('pecosas:edit');
  const { session } = useAuth();
  const queryClient = useQueryClient();

const [printCfg, setPrintCfg] = useState<PrintCfg>(() => loadPrintCfg());
const [openPrintCfg, setOpenPrintCfg] = useState(false);

// Persistir ajustes de impresión (local)
try { localStorage.setItem('pecosa_print_cfg_v1', JSON.stringify(printCfg)); } catch {}


  const [q, setQ] = useState('');
  const [start, setStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [end, setEnd] = useState(new Date().toISOString().split('T')[0]);

// Filtros avanzados
const [statusF, setStatusF] = useState<'ALL' | 'EMITIDA' | 'ANULADA'>('ALL');
const [catF, setCatF] = useState<string>('ALL');
const [destF, setDestF] = useState<string>('');
const [minAmt, setMinAmt] = useState<string>('');
const [maxAmt, setMaxAmt] = useState<string>('');

// Detalle
const [openDetail, setOpenDetail] = useState(false);
const [detailRow, setDetailRow] = useState<any>(null);
const [detailLines, setDetailLines] = useState<any[]>([]);


  // Modal anulación
  const [openAnular, setOpenAnular] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [just, setJust] = useState('');

  const { data, error, isFetching } = useQuery({
    queryKey: ['pecosas_mvp', start, end],
    enabled: canView,
    queryFn: async () => {

// Parse YYYY-MM-DD safely as LOCAL day boundaries (avoid UTC/local drift in Electron).
const parseLocalDayStart = (s: string) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  if (!y || !m || !d) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};
const parseLocalDayEnd = (s: string) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  if (!y || !m || !d) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

const startTime = parseLocalDayStart(start);
const endTime = parseLocalDayEnd(end);

// Prefer transactions for PECOSAS (si existe). Si falla por schema cache, lanzamos error guiado.
const { data, error } = await supabase
  .from('transactions')
  .select('*')
  .gte('created_at', startTime.toISOString())
  .lte('created_at', endTime.toISOString())
  .order('created_at', { ascending: false })
  .limit(500);
      if (error) {
        const msg = String((error as any)?.message || '');
        if (msg.toLowerCase().includes('schema cache')) {
          throw new Error(msg + helpCache);
        }
        throw error;
      }
      return data || [];
    },
    staleTime: 15_000,
  });

  const rows: any[] = data || [];

  // Refs para resolver destino desde movements
  const pecosaRefs = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r?.pecosa_ref) s.add(String(r.pecosa_ref));
    return Array.from(s);
  }, [rows]);

  const { data: destinoMap } = useQuery({
    queryKey: ['pecosa_destinos', pecosaRefs.join('|')],
    enabled: canView && pecosaRefs.length > 0,
    queryFn: async () => {
      const { data: movs, error } = await supabase
        .from('movements')
        .select('pecosa_ref, center_id, patient_id, observation, created_at')
        .eq('type', 'OUT')
        .in('pecosa_ref', pecosaRefs)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;
      const m = movs || [];

      const centerIds = Array.from(new Set(m.map((x: any) => x.center_id).filter(Boolean)));
      const patientIds = Array.from(new Set(m.map((x: any) => x.patient_id).filter(Boolean)));

      let centersById: Record<string, string> = {};
      let patientsById: Record<string, string> = {};

      if (centerIds.length > 0) {
        const { data: centers } = await supabase.from('centers').select('id,name').in('id', centerIds);
        (centers || []).forEach((c: any) => { centersById[String(c.id)] = String(c.name || ''); });
      }

      if (patientIds.length > 0) {
        const { data: patients } = await supabase.from('patients').select('id,name,dni').in('id', patientIds);
        (patients || []).forEach((p: any) => { patientsById[String(p.id)] = String(p.name || ''); });
      }

      const map: Record<string, string> = {};
      for (const x of m) {
        const ref = String(x.pecosa_ref || '');
        if (!ref || map[ref]) continue;

        const pName = x.patient_id ? patientsById[String(x.patient_id)] : '';
        if (pName) { map[ref] = pName; continue; }

        const cName = x.center_id ? centersById[String(x.center_id)] : '';
        if (cName) { map[ref] = cName; continue; }

        const obs = String(x.observation || '');
        map[ref] = parsePantbcName(obs) || parseGenericDestino(obs) || '';
      }

      return map;
    },
    staleTime: 15_000,
  });

  

const loadDetail = async (row: any) => {
  try {
    const ref = String(row?.pecosa_ref || '').trim();
    if (!ref) return;
    // Movimientos OUT
    const { data: movs, error: mErr } = await supabase
      .from('movements')
      .select('product_id,quantity,batch_id,center_id,patient_id,observation,created_at')
      .eq('type','OUT')
      .eq('pecosa_ref', ref)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (mErr) throw mErr;

    const productIds = Array.from(new Set((movs||[]).map((m:any)=>m.product_id).filter(Boolean)));
    const { data: prods } = await supabase.from('products').select('id,name,unit,average_cost').in('id', productIds as any);
    const prodBy: any = {};
    (prods||[]).forEach((p:any)=> prodBy[String(p.id)] = p);

    const batchIds = Array.from(new Set((movs||[]).map((m:any)=>m.batch_id).filter(Boolean)));
    const batchBy: any = {};
    if (batchIds.length > 0) {
      const { data: bats } = await supabase.from('batches').select('id,batch_code,expiry_date').in('id', batchIds as any);
      (bats||[]).forEach((b:any)=> batchBy[String(b.id)] = b);
    }

    const lines = (movs||[]).map((m:any) => {
      const p = prodBy[String(m.product_id)] || {};
      const qty = Number(m.quantity||0);
      const pu = Number(p.average_cost||0);
      return {
        product_id: m.product_id,
        name: p.name || `Producto ${m.product_id}`,
        unit: p.unit || '',
        qty,
        pu,
        total: qty * pu,
        batch_id: m.batch_id || null,
        batch_code: (batchBy[String(m.batch_id)]||{})?.batch_code || '',
        expiry_date: (batchBy[String(m.batch_id)]||{})?.expiry_date || null,
      };
    });
    setDetailLines(lines);
  } catch (e) {
    notifyError(e);
    setDetailLines([]);
  }
};

const getDestino = (r: any) => {
    const ref = String(r?.pecosa_ref || '');
    const cat = String(r?.category || '').toUpperCase();
    const fromMap = (destinoMap && ref) ? destinoMap[ref] : '';

    const text = String(r?.justification || '');
    const parsed = cat === 'PANTBC'
      ? (parsePantbcName(text) || parsePantbcName(String(r?.meta?.observation || '')))
      : (parseGenericDestino(text) || parseGenericDestino(String(r?.meta?.observation || '')));

    return (fromMap || parsed || '—').toString();
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (q) {
      const uq = q.toUpperCase();
      out = out.filter((r:any) => JSON.stringify(r).toUpperCase().includes(uq));
    }
    if (statusF !== 'ALL') {
      out = out.filter((r:any) => String(r?.status || '').toUpperCase() === statusF);
    }
    if (catF !== 'ALL') {
      out = out.filter((r:any) => String(r?.category || '').toUpperCase() === String(catF).toUpperCase());
    }
    if (destF.trim()) {
      const d = destF.trim().toUpperCase();
      out = out.filter((r:any) => String(getDestino(r)).toUpperCase().includes(d));
    }
    const minV = Number(minAmt || '');
    const maxV = Number(maxAmt || '');
    if (Number.isFinite(minV)) out = out.filter((r:any) => Number(r?.amount || 0) >= minV);
    if (Number.isFinite(maxV) && maxAmt !== '') out = out.filter((r:any) => Number(r?.amount || 0) <= maxV);
    return out;
  }, [rows, q, statusF, catF, destF, minAmt, maxAmt, destinoMap]);

  const exportRows = useMemo(() => {
    return filtered.map((r:any) => ({ ...r, pecosa_numero: r?.pecosa_ref, destino: getDestino(r) }));
  }, [filtered, destinoMap]);

  const exportXlsx = () => {
    try {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows), 'PECOSAS');
      XLSX.writeFile(wb, `Libro_PECOSAS_${start}_a_${end}.xlsx`);
      notifySuccess('Exportado a Excel');
    } catch (e) { notifyError(e); }
  };

  const exportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text('LIBRO PECOSAS (MVP)', 14, 14);
      autoTable(doc, {
        styles: { font: printCfg.fontFamily, fontSize: Number(printCfg.tableFontSize||10), cellPadding: Number(printCfg.cellPadding||2), textColor: 0, lineColor: 0, lineWidth: Number(printCfg.lineWidth||0.6) },
        headStyles: { fillColor: [255,255,255], textColor: 0, fontStyle: 'bold', lineColor: 0, lineWidth: 0.35 },
        startY: 18,
        head: [['Fecha','N° PECOSA','Destino','Tipo','Categoría','Monto','Estado','Motivo']],
        body: exportRows.map((r:any) => [
          r.created_at ? new Date(r.created_at).toLocaleString() : '',
          fmt(r.pecosa_ref),
          fmt(r.destino),
          fmt(r.type),
          fmt(r.category),
          fmt(r.amount),
          fmt(r.status),
          fmt(r.justification)
        ])
      });
      doc.save(`Libro_PECOSAS_${start}_a_${end}.pdf`);
    } catch (e) { notifyError(e); }
  };


// --- Reimpresión de PECOSA desde BD (mismos datos iniciales) ---
const money = (n: any) => {
  const v = Number(n || 0);
  return (Number.isFinite(v) ? v : 0).toFixed(2);
};

const parseDays = (text: string) => {
  const m = String(text || '').match(/(?:DIAS|D[IÍ]AS)\s*[:=]\s*(\d{1,3})/i);
  return m ? Number(m[1]) : null;
};

const fetchSignatures = async (category: string) => {
  const cat = String(category || '').toUpperCase();
  const keys = cat === 'PANTBC'
    ? ['pantbc_solicitante', 'pantbc_distribuidor']
    : (cat === 'OLLAS'
      ? ['ollas_solicitante', 'pca_distribuidor']
      : ['pca_solicitante', 'pca_distribuidor']);

  const { data } = await supabase.from('app_settings').select('key,value').in('key', keys);
  const map: any = {};
  (data || []).forEach((x: any) => { map[x.key] = x.value; });
  return {
    solicitante: String(map[keys[0]] || '---'),
    distribuidor: String(map[keys[1]] || '---'),
  };
};

const reprintPecosa = async (row: any) => {
  try {
    const ref = String(row?.pecosa_ref || '').trim();
    if (!ref) throw new Error('PECOSA inválida');

    const { data: movs, error: movErr } = await supabase
      .from('movements')
      .select('created_at,product_id,quantity,batch_id,center_id,patient_id,observation')
      .eq('type', 'OUT')
      .eq('pecosa_ref', ref)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (movErr) throw movErr;
    if (!movs || movs.length === 0) throw new Error('No se encontraron movimientos para reimprimir esta PECOSA.');

    const productIds = Array.from(new Set(movs.map((m: any) => m.product_id).filter(Boolean)));
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id,name,unit,average_cost')
      .in('id', productIds);
    if (pErr) throw pErr;
    const prodById: any = {};
    (products || []).forEach((p: any) => { prodById[String(p.id)] = p; });

    const batchIds = Array.from(new Set(movs.map((m: any) => m.batch_id).filter(Boolean)));
    const { data: batches } = batchIds.length ? await supabase.from('batches').select('id,batch_code,expiry_date').in('id', batchIds as any) : { data: [] };
    const batchById: any = {};
    (batches || []).forEach((b: any) => { batchById[String(b.id)] = b; });

    const first: any = movs[0];
    const centerId = first?.center_id;
    const patientId = first?.patient_id;

    let destino = '—';
    let responsableDestino = '—';

    if (patientId) {
      const { data: pa } = await supabase.from('patients').select('id,name,dni').eq('id', patientId).maybeSingle();
      destino = String(pa?.name || 'PACIENTE');
      responsableDestino = String(pa?.dni || '---');
    } else if (centerId) {
      const { data: c } = await supabase.from('centers').select('id,name,president_name').eq('id', centerId).maybeSingle();
      destino = String(c?.name || 'CENTRO');
      responsableDestino = String(c?.president_name || '---');
    } else {
      destino = parsePantbcName(String(first?.observation || '')) || parseGenericDestino(String(first?.observation || '')) || '—';
    }

    const days = parseDays(String(first?.observation || '')) || parseDays(String(row?.justification || ''));
    const sig = await fetchSignatures(String(row?.category || ''));

    const anulada = String(row?.status || '').toUpperCase() === 'ANULADA';
    const paper = (printCfg.paper || 'CONTINUO_9_5x11');
    const fmt: any = paper === 'CONTINUO_9_5x11' ? [241.3, 279.4] : 'a4';
    const doc = new jsPDF({ unit: 'mm', format: fmt, orientation: 'portrait' });

    doc.setLineWidth(Number(printCfg.lineWidth||0.6));
    doc.setFont(printCfg.fontFamily, printCfg.bold ? "bold" : "normal");
    doc.setFontSize(Number(printCfg.headerFontSize||16));
    doc.text('MUNICIPALIDAD PROVINCIAL DE ANDAHUAYLAS', 105, 14, { align: 'center' });
    doc.setFontSize(Number(printCfg.subHeaderFontSize||13));
    doc.text('NOTA DE PEDIDO DE COMPROBANTE DE SALIDA (PECOSA)', 105, 22, { align: 'center' });

    if (anulada) {
      doc.setTextColor(200, 0, 0);
      doc.setFontSize(16);
      doc.text('*** ANULADA ***', 105, 30, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }

    doc.setFontSize(Number(printCfg.bodyFontSize||11));
    doc.text(`N° PECOSA: ${ref}`, 14, 36);
    doc.text(`FECHA: ${row?.created_at ? new Date(row.created_at).toLocaleDateString() : new Date().toLocaleDateString()}`, 140, 36);
    doc.text(`DESTINO: ${destino}`, 14, 42);
    doc.text(`RESPONSABLE DESTINO: ${responsableDestino}`, 14, 48);
    doc.text(`SOLICITANTE: ${sig.solicitante}`, 14, 54);
    doc.text(`RESP. DISTRIBUCIÓN (ALMACÉN): ${sig.distribuidor}`, 14, 60);
    if (days) doc.text(`DÍAS ATENCIÓN: ${days}`, 140, 42);

    const body = movs.map((m: any, idx: number) => {
      const p = prodById[String(m.product_id)] || {};
      const unit = String(p.unit || '');
      const qty = Number(m.quantity || 0);
      const pu = Number(p.average_cost || 0);
      const total = qty * pu;
      return [
        idx + 1,
        String(p.name || `Producto ${m.product_id}`),
        unit,
        qty.toFixed(2),
        `S/. ${money(pu)}`,
        `S/. ${money(total)}`,
      ];
    });

    autoTable(doc, {
      startY: 66,
      head: [['N°', 'DESCRIPCIÓN', 'UNIDAD', 'CANTIDAD', 'P. UNIT', 'VALOR TOTAL']],
      body,
      styles: { font: printCfg.fontFamily, fontSize: Number(printCfg.tableFontSize||10), cellPadding: Number(printCfg.cellPadding||2), textColor: 0, lineColor: 0, lineWidth: Number(printCfg.lineWidth||0.6) },
      headStyles: { fillColor: [245, 245, 245], textColor: 20 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 66;
    const y = Math.min(finalY + 20, 260);
    doc.setFontSize(Number(printCfg.bodyFontSize||11));
    doc.text('_____________________________', 20, y);
    doc.text('_____________________________', 120, y);
    doc.setFontSize(9);
    doc.text('SOLICITANTE', 20, y + 6);
    doc.text(String(sig.solicitante || '---'), 20, y + 11);
    doc.text('RESP. ALMACÉN / DISTRIBUCIÓN', 120, y + 6);
    doc.text(String(sig.distribuidor || '---'), 120, y + 11);

    doc.save(`PECOSA_${ref}_${anulada ? 'ANULADA' : 'EMITIDA'}.pdf`);
    notifySuccess('PECOSA reimpresa en PDF.');
  } catch (e) {
    notifyError(e);
  }
};

  const anularMutation = useMutation({
    mutationFn: async () => {
      if (!target?.pecosa_ref) throw new Error('PECOSA inválida');
      if (!just || just.trim().length < 5) throw new Error('Justificación mínima 5 caracteres');
      const { data, error } = await supabase.rpc('anular_pecosa', {
        p_pecosa_ref: String(target.pecosa_ref),
        p_justification: just.trim(),
        p_user_email: session?.user?.email || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      notifySuccess('PECOSA anulada');
      setOpenAnular(false);
      setTarget(null);
      setJust('');
      queryClient.invalidateQueries({ queryKey: ['pecosas_mvp'] });
    },
    onError: (e:any) => notifyError(e?.message || e),
  });

  if (!canView) {
    return (
      <div className="bg-white p-6 rounded border">
        <div className="font-bold text-red-700">Acceso restringido</div>
        <div className="text-sm text-gray-600 mt-1">No tienes permiso para ver el Libro de PECOSAS.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-4 rounded border flex flex-wrap items-center gap-2">
        <FileText className="text-blue-600" />
        <div className="font-bold">Libro de PECOSAS (MVP)</div>
        <input type="date" value={start} onChange={e=> setStart(e.target.value)} className="border p-1 rounded text-sm"/>
        <span className="text-gray-400">—</span>
        <input type="date" value={end} onChange={e=> setEnd(e.target.value)} className="border p-1 rounded text-sm"/>
        <div className="relative">
          <Search className="absolute left-2 top-2 text-gray-400" size={14}/>
          <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Buscar" className="pl-7 pr-3 py-1 border rounded text-sm"/>
        </div>
        <button onClick={exportXlsx} className="ml-auto px-3 py-1 border rounded text-sm flex items-center gap-1"><Download size={14}/> Excel</button>
        <button onClick={exportPdf} className="px-3 py-1 border rounded text-sm flex items-center gap-1"><FileText size={14}/> PDF</button>
            <button onClick={() => setOpenPrintCfg(v=>!v)} className="px-3 py-2 border rounded text-xs font-bold flex items-center gap-2 bg-white hover:bg-gray-50"><Filter size={14}/> Ajustes impresión</button>



{openPrintCfg && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-5xl rounded shadow-lg border-t-4 border-gray-900 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-gray-800">Ajustes de impresión (PECOSA)</div>
          <div className="text-xs text-gray-500">Matricial (cinta) · Papel continuo 9.5×11 por defecto. Ajustes guardados en este equipo.</div>
        </div>
        <button className="text-xs font-bold text-gray-500" onClick={() => setOpenPrintCfg(false)}>CERRAR</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
        <div>
          <label className="text-[11px] font-bold text-gray-600">Fuente</label>
          <select value={printCfg.fontFamily} onChange={e=> setPrintCfg(p=> ({...p, fontFamily: e.target.value as any}))} className="w-full border rounded px-2 py-2 text-sm">
            <option value="courier">Courier (matricial)</option>
            <option value="helvetica">Helvetica</option>
            <option value="times">Times</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-gray-600">Papel</label>
          <select value={printCfg.paper} onChange={e=> setPrintCfg(p=> ({...p, paper: e.target.value as any}))} className="w-full border rounded px-2 py-2 text-sm">
            <option value="CONTINUO_9_5x11">Continuo 9.5x11</option>
            <option value="A4">A4</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-gray-600">Encabezado</label>
          <input type="number" value={printCfg.headerFontSize} onChange={e=> setPrintCfg(p=> ({...p, headerFontSize: Number(e.target.value||18)}))} className="w-full border rounded px-2 py-2 text-sm" />
        </div>

        <div>
          <label className="text-[11px] font-bold text-gray-600">Texto</label>
          <input type="number" value={printCfg.bodyFontSize} onChange={e=> setPrintCfg(p=> ({...p, bodyFontSize: Number(e.target.value||12)}))} className="w-full border rounded px-2 py-2 text-sm" />
        </div>

        <div>
          <label className="text-[11px] font-bold text-gray-600">Tabla</label>
          <input type="number" value={printCfg.tableFontSize} onChange={e=> setPrintCfg(p=> ({...p, tableFontSize: Number(e.target.value||11)}))} className="w-full border rounded px-2 py-2 text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <input id="bold" type="checkbox" checked={printCfg.bold} onChange={e=> setPrintCfg(p=> ({...p, bold: e.target.checked}))} />
          <label htmlFor="bold" className="text-sm font-bold text-gray-700">Negrita</label>
        </div>

        <div>
          <label className="text-[11px] font-bold text-gray-600">Grosor líneas</label>
          <input type="number" step="0.1" value={printCfg.lineWidth} onChange={e=> setPrintCfg(p=> ({...p, lineWidth: Number(e.target.value||1.0)}))} className="w-full border rounded px-2 py-2 text-sm" />
        </div>

        <div>
          <label className="text-[11px] font-bold text-gray-600">Padding</label>
          <input type="number" value={printCfg.cellPadding} onChange={e=> setPrintCfg(p=> ({...p, cellPadding: Number(e.target.value||2)}))} className="w-full border rounded px-2 py-2 text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <input id="showLot" type="checkbox" checked={printCfg.showLot} onChange={e=> setPrintCfg(p=> ({...p, showLot: e.target.checked}))} />
          <label htmlFor="showLot" className="text-sm font-bold text-gray-700">Lote/Vence</label>
        </div>

        <div className="md:col-span-5 flex justify-end gap-2">
          <button className="px-3 py-2 text-xs font-bold border rounded bg-white" onClick={() => setPrintCfg(DEFAULT_PRINT_CFG)}>Restaurar</button>
          <button className="px-3 py-2 text-xs font-bold rounded bg-gray-900 text-white" onClick={() => setOpenPrintCfg(false)}>OK</button>
        </div>
      </div>
    </div>
  </div>
)}

      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded text-sm flex items-start gap-2 whitespace-pre-wrap">
          <AlertTriangle size={16} className="mt-0.5"/> {String((error as any)?.message || '')}
        </div>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-2">Fecha</th>
              <th className="p-2">N° PECOSA</th>
              <th className="p-2">Destino</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Categoría</th>
              <th className="p-2 text-right">Monto</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Motivo</th>
              <th className="p-2 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r:any)=> {
              const destino = getDestino(r);
              const anulada = String(r?.status || '').toUpperCase() === 'ANULADA';
              return (
                <tr key={r.id} className={`border-b hover:bg-gray-50 ${anulada ? 'opacity-75' : ''}`}>
                  <td className="p-2 text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                  <td className="p-2 font-mono font-bold">{fmt(r.pecosa_ref)}</td>
                  <td className="p-2 font-semibold">{destino}</td>
                  <td className="p-2">{fmt(r.type)}</td>
                  <td className="p-2">{fmt(r.category)}</td>
                  <td className="p-2 text-right font-bold">{fmt(r.amount)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${anulada ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {fmt(r.status)}
                    </span>
                  </td>
                  <td className="p-2">{fmt(r.justification)}</td>
                  <td className="p-2 text-center">

<div className="flex flex-col items-center gap-2">
  <button
    className="bg-gray-800 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-900 flex items-center gap-1"
    onClick={async () => { setDetailRow(r); setOpenDetail(true); await loadDetail(r); }}
  >
    <Eye size={14}/> Detalle</button>

                      <button
                        className="bg-gray-800 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-900 flex items-center gap-1"
                        onClick={() => reprintPecosa(r)} >
                        <Printer size={14}/> Reimprimir
  </button>

  {canEdit && !anulada ? (
    <button
      className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700"
      onClick={() => { setTarget(r); setJust(''); setOpenAnular(true); }}
    >
      Anular
    </button>
  ) : (
    <span className="text-xs text-gray-400">—</span>
  )}
</div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td className="p-4 text-gray-400" colSpan={9}>{isFetching?'Cargando...':'Sin registros.'}</td></tr>}
          </tbody>
        </table>
      </div>



{openDetail && detailRow && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-4xl rounded shadow border-t-4 border-gray-900 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800">Detalle PECOSA — {String(detailRow.pecosa_ref)}</h3>
        <button onClick={() => { setOpenDetail(false); setDetailRow(null); setDetailLines([]); }} className="text-xs font-bold text-gray-500">CERRAR</button>
      </div>

      <div className="text-sm text-gray-600 mb-2">Destino: <span className="font-bold">{getDestino(detailRow)}</span></div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2 text-left">Producto</th>
              <th className="p-2">Unidad</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-right">P. Unit</th>
              <th className="p-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(detailLines || []).map((l:any, i:number) => (
              <tr key={i} className={i%2?'bg-white':'bg-gray-50/40'}>
                <td className="p-2 font-semibold">{l.name}</td>
                <td className="p-2 text-center">{l.unit}</td>
                <td className="p-2 text-right">{Number(l.qty||0).toFixed(2)}</td>
                <td className="p-2 text-right">S/. {Number(l.pu||0).toFixed(2)}</td>
                <td className="p-2 text-right font-bold">S/. {Number(l.total||0).toFixed(2)}</td>
              </tr>
            ))}
            {(!detailLines || detailLines.length===0) && (
              <tr><td className="p-4 text-gray-400" colSpan={5}>Sin líneas o sin conexión.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}

      {openAnular && target && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded shadow border-t-4 border-red-600 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Anular PECOSA — {String(target.pecosa_ref)}</h3>
              <button onClick={() => setOpenAnular(false)} className="text-xs font-bold text-gray-500">CERRAR</button>
            </div>

            <div className="text-sm text-gray-600 mb-2">
              Destino: <span className="font-bold">{getDestino(target)}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500">JUSTIFICACIÓN (mín. 5 caracteres)</label>
                <textarea
                  value={just}
                  onChange={e=> setJust(e.target.value)}
                  className="w-full border p-2 rounded text-sm min-h-[90px]"
                  placeholder="Detalle de la anulación..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setOpenAnular(false)} className="px-4 py-2 text-xs font-bold text-gray-600">CANCELAR</button>
                <button
                  onClick={() => anularMutation.mutate()}
                  disabled={anularMutation.isPending}
                  className="px-5 py-2 rounded bg-red-600 text-white text-xs font-bold disabled:bg-gray-400"
                >
                  {anularMutation.isPending ? 'ANULANDO...' : 'CONFIRMAR'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

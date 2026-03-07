import React, { useMemo, useState } from 'react';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase, logAction } from '../lib/supabase';

type BackupPayload = {
  meta: {
    version: string;
    created_at: string;
    app: string;
  };
  tables: Record<string, any[]>;
};

const BACKUP_VERSION = 'backup-json-v1';

// Tablas candidatas (incluye pizzería + módulos operativos del ZIP).
// Si alguna no existe en tu BD, se omite de forma segura.
const TABLES_CANDIDATE = [
  // Pizzería
  'config',
  'products',
  'customers',
  'orders',
  'order_requests',
  'promotions',
  'promo_events',
  'system_logs',

  // Operación/inventario (si aplica)
  'app_settings',
  'profiles',
  'user_permissions',
  'app_users',
  'users',

  'centers',
  'patients',
  'batches',
  'movements',
  'transactions',
  'monthly_closures',

  'kits',
  'kit_items',
  'ration_rules',

  'audit_logs',
  'client_errors',

  // PANTBC (si aplica)
  'pantbc_patients',
  'pantbc_deliveries',
  'pantbc_compliance',
] as const;

// Orden seguro de restauración (padres/maestros primero, transaccional al final)
const RESTORE_ORDER = [
  'profiles',
  'user_permissions',
  'users',
  'app_users',
  'app_settings',
  'config',

  'customers',
  'products',
  'promotions',

  'centers',
  'patients',
  'kits',
  'kit_items',
  'ration_rules',
  'batches',

  'orders',
  'order_requests',

  'movements',
  'transactions',
  'monthly_closures',

  'promo_events',
  'audit_logs',
  'client_errors',
  'system_logs',

  'pantbc_patients',
  'pantbc_deliveries',
  'pantbc_compliance',
] as const;

// Tablas a limpiar en Wipe (NO tocamos config/perfiles/permisos por defecto).
const WIPE_TABLES_DEFAULT = [
  // Pizzería
  'orders',
  'order_requests',
  'system_logs',
  'promo_events',

  // Operación/inventario
  'movements',
  'transactions',
  'batches',
  'monthly_closures',
  'patients',
  'centers',
  'kits',
  'kit_items',
  'ration_rules',

  // Catálogos operativos
  'customers',
  'products',
  'promotions',

  // Observabilidad
  'audit_logs',
  'client_errors',

  // PANTBC
  'pantbc_deliveries',
  'pantbc_compliance',
  'pantbc_patients',
] as const;

function downloadTextFile(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchAllRows(table: string) {
  const out: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function inferOnConflict(table: string, rows: any[]): string | undefined {
  if (!rows || rows.length === 0) return undefined;
  const sample = rows[0] || {};

  if (table === 'config' && 'key' in sample) return 'key';
  if (table === 'app_settings' && 'key' in sample) return 'key';
  if (table === 'user_permissions' && 'user_id' in sample) return 'user_id';

  if ('id' in sample) return 'id';
  if ('slug' in sample) return 'slug';
  if ('email' in sample) return 'email';

  return undefined;
}

async function upsertInChunks(table: string, rows: any[], onConflict?: string) {
  const chunkSize = 250;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (!onConflict) {
      const { error } = await supabase.from(table).insert(chunk);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).upsert(chunk, { onConflict });
      if (error) throw error;
    }
  }
}

async function safeDeleteAll(table: string) {
  // PostgREST no permite delete sin filtro. Para borrar todo de forma segura:
  // - Si hay id: delete().neq('id', 0)
  // - Si hay key: delete().neq('key','__KEEP__')
  // - Si hay user_id: delete().neq('user_id','0000..')
  // - Si hay created_at: delete().neq('created_at','1970-01-01T00:00:00Z')
  // - Si está vacío: no hace nada

  const probe = await supabase.from(table).select('*').limit(1);
  if (probe.error) throw probe.error;
  if (!probe.data || probe.data.length === 0) return;

  const sample = probe.data[0] || {};

  if (Object.prototype.hasOwnProperty.call(sample, 'id')) {
    const { error } = await supabase.from(table).delete().neq('id' as any, 0 as any);
    if (error) throw error;
    return;
  }

  if (Object.prototype.hasOwnProperty.call(sample, 'key')) {
    const { error } = await supabase.from(table).delete().neq('key' as any, '__KEEP__' as any);
    if (error) throw error;
    return;
  }

  if (Object.prototype.hasOwnProperty.call(sample, 'user_id')) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('user_id' as any, '00000000-0000-0000-0000-000000000000' as any);
    if (error) throw error;
    return;
  }

  if (Object.prototype.hasOwnProperty.call(sample, 'created_at')) {
    const { error } = await supabase.from(table).delete().neq('created_at' as any, '1970-01-01T00:00:00Z' as any);
    if (error) throw error;
    return;
  }

  throw new Error(`No se pudo inferir un filtro seguro para borrar en ${table}.`);
}

export default function DangerZoneDbTools() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [details, setDetails] = useState<string>('');

  const [deleteCode, setDeleteCode] = useState('');
  const [restoreCode, setRestoreCode] = useState('');
  const [backupFile, setBackupFile] = useState<File | null>(null);

  const tablesCandidate = useMemo(() => Array.from(new Set(TABLES_CANDIDATE)), []);

  const doBackup = async () => {
    setBusy(true);
    setStatus('Generando backup…');
    setDetails('');

    const tables: Record<string, any[]> = {};
    const skipped: string[] = [];
    const errors: string[] = [];

    try {
      for (const t of tablesCandidate) {
        setStatus(`Leyendo tabla: ${t}…`);
        try {
          const rows = await fetchAllRows(t);
          tables[t] = rows;
        } catch (e: any) {
          skipped.push(t);
          errors.push(`${t}: ${e?.message || String(e)}`);
        }
      }

      const payload: BackupPayload = {
        meta: {
          version: BACKUP_VERSION,
          created_at: new Date().toISOString(),
          app: 'pizzamaster',
        },
        tables,
      };

      const filename = `backup_full_db_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      downloadTextFile(filename, JSON.stringify(payload, null, 2));

      logAction('Admin', 'BACKUP_FULL_DB', `tables=${Object.keys(tables).length}; skipped=${skipped.length}`);

      setStatus('✅ Backup generado');
      setDetails(
        `Incluidas: ${Object.keys(tables).length} tablas
` +
          (skipped.length ? `Omitidas (no existen o sin permisos): ${skipped.join(', ')}
` : '') +
          (errors.length ? `
Detalles:
- ${errors.join('\n- ')}` : '')
      );
    } catch (err: any) {
      setStatus('❌ Error generando backup');
      setDetails(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const doWipe = async () => {
    if (deleteCode.trim().toUpperCase() !== 'ELIMINAR-DATOS') {
      alert('Debes escribir exactamente: ELIMINAR-DATOS');
      return;
    }
    const ok = confirm('Esto borrará SOLO datos operativos. ¿Continuar?');
    if (!ok) return;

    setBusy(true);
    setStatus('Eliminando datos operativos…');
    setDetails('');

    const wiped: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    try {
      for (const t of WIPE_TABLES_DEFAULT) {
        setStatus(`Borrando: ${t}…`);
        try {
          await safeDeleteAll(t);
          wiped.push(t);
        } catch (e: any) {
          skipped.push(t);
          errors.push(`${t}: ${e?.message || String(e)}`);
        }
      }

      logAction('Admin', 'WIPE_OPERATIVE_DATA', `wiped=${wiped.length}; skipped=${skipped.length}`);

      setStatus('✅ Wipe completado');
      setDetails(
        `Borradas: ${wiped.join(', ')}
` +
          (skipped.length ? `
Omitidas (no existen o error): ${skipped.join(', ')}
` : '') +
          (errors.length ? `
Detalles:
- ${errors.join('\n- ')}` : '')
      );

      alert('Wipe completado. Recomiendo recargar la página o cambiar de pestaña para refrescar datos.');
    } catch (err: any) {
      setStatus('❌ Error en wipe');
      setDetails(err?.message || String(err));
    } finally {
      setBusy(false);
      setDeleteCode('');
    }
  };

  const doRestore = async () => {
    if (restoreCode.trim().toUpperCase() !== 'RESTORE-DATOS') {
      alert('Debes escribir exactamente: RESTORE-DATOS');
      return;
    }
    if (!backupFile) {
      alert('Selecciona un archivo .json de backup');
      return;
    }

    setBusy(true);
    setStatus('Restaurando…');
    setDetails('');

    try {
      const text = await backupFile.text();
      const payload = JSON.parse(text) as BackupPayload;

      if (!payload?.meta?.version || payload.meta.version !== BACKUP_VERSION) {
        throw new Error('Backup inválido o versión no compatible.');
      }
      if (!payload.tables || typeof payload.tables !== 'object') {
        throw new Error('Backup inválido: falta el bloque tables.');
      }

      const tables = payload.tables;
      const restored: string[] = [];

      for (const t of RESTORE_ORDER) {
        const rows = tables[t];
        if (!rows || rows.length === 0) continue;

        setStatus(`Restaurando ${t} (${rows.length})…`);

        const onConflict = inferOnConflict(t, rows);
        await upsertInChunks(t, rows, onConflict);
        restored.push(t);
      }

      logAction('Admin', 'RESTORE_FULL_DB', `tables=${restored.length}`);

      setStatus('✅ Restauración completada');
      setDetails(`Restauradas: ${restored.join(', ')}`);

      alert('Restauración completada. Recomiendo recargar la página para refrescar la UI.');
    } catch (err: any) {
      setStatus('❌ Error restaurando');
      setDetails(err?.message || String(err));
    } finally {
      setBusy(false);
      setRestoreCode('');
      setBackupFile(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-red-300 mt-1" size={20} />
        <div>
          <div className="font-bold text-red-200">Acciones de base de datos (quirúrgico)</div>
          <div className="text-sm text-red-200/80">
            Backup/Restore en <b>JSON</b>. El Wipe borra <b>solo datos</b> (no toca esquema). Mantiene <b>config/perfiles/permisos</b> por defecto.
          </div>
        </div>
      </div>

      <div className="bg-black/20 border border-red-800/40 rounded-lg p-4">
        <div className="font-bold text-white mb-2">1) Descargar Backup Full DB (JSON)</div>
        <button
          onClick={doBackup}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold px-4 py-2 rounded"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          Descargar backup
        </button>
        <div className="text-xs text-red-200/70 mt-2">
          Nota: si alguna tabla no existe en tu Supabase, se omitirá de forma segura.
        </div>
      </div>

      <div className="bg-black/20 border border-red-800/40 rounded-lg p-4">
        <div className="font-bold text-white mb-2">2) Eliminar Datos Operativos (Wipe)</div>
        <div className="text-sm text-red-200/80 mb-3">
          Esto elimina datos en tablas operativas (pedidos, movimientos, etc.). <b>No elimina usuarios/perfiles/config</b>.
        </div>
        <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-red-200/80 mb-1">Escribe: ELIMINAR-DATOS</label>
            <input
              value={deleteCode}
              onChange={(e) => setDeleteCode(e.target.value)}
              className="w-full bg-black/40 border border-red-700/60 rounded px-3 py-2 text-white font-bold uppercase"
              placeholder="ELIMINAR-DATOS"
            />
          </div>
          <button
            onClick={doWipe}
            disabled={busy || deleteCode.trim().toUpperCase() !== 'ELIMINAR-DATOS'}
            className="inline-flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 disabled:bg-gray-600 text-white font-bold px-4 py-2 rounded"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
            Ejecutar wipe
          </button>
        </div>
        <details className="mt-3 text-xs text-red-200/70">
          <summary className="cursor-pointer select-none">Ver tablas que se limpian</summary>
          <div className="mt-2">{WIPE_TABLES_DEFAULT.join(', ')}</div>
        </details>
      </div>

      <div className="bg-black/20 border border-red-800/40 rounded-lg p-4">
        <div className="font-bold text-white mb-2">3) Restaurar Backup Full DB (JSON)</div>
        <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-red-200/80 mb-1">Archivo .json</label>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
              className="w-full text-red-200/80"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-red-200/80 mb-1">Escribe: RESTORE-DATOS</label>
            <input
              value={restoreCode}
              onChange={(e) => setRestoreCode(e.target.value)}
              className="w-full bg-black/40 border border-red-700/60 rounded px-3 py-2 text-white font-bold uppercase"
              placeholder="RESTORE-DATOS"
            />
          </div>
          <button
            onClick={doRestore}
            disabled={busy || restoreCode.trim().toUpperCase() !== 'RESTORE-DATOS' || !backupFile}
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold px-4 py-2 rounded"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            Restaurar
          </button>
        </div>
        <div className="text-xs text-red-200/70 mt-2">La restauración se ejecuta en orden seguro.</div>
      </div>

      <div className="bg-black/30 border border-red-800/30 rounded-lg p-4">
        <div className="flex items-center gap-2 font-bold text-white">
          {status.startsWith('✅') ? <CheckCircle2 className="text-green-400" size={18} /> : null}
          {status}
        </div>
        {details ? <pre className="mt-2 text-xs text-red-100/80 whitespace-pre-wrap">{details}</pre> : null}
      </div>
    </div>
  );
}

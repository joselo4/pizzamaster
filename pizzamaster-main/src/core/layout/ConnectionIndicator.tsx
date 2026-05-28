import { useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useDbHealth } from '../services/dbHealth';
import { syncQueue } from '../services/offlineQueue';
import { notifySuccess } from '../utils/notify';

export const ConnectionIndicator = () => {
  const { health, refresh } = useDbHealth(25_000);

  useEffect(() => {
    if (health.status === 'online') {
      (async () => {
        const res = await syncQueue(80);
        if (res.synced > 0) notifySuccess(`Sincronizado offline: ${res.synced} operación(es).`);
      })();
    }
  }, [health.status]);

  const color =
    health.status === 'online' ? 'bg-green-400' : health.status === 'waking' ? 'bg-yellow-300' : 'bg-red-400';

  return (
    <button
      onClick={() => refresh()}
      className="w-full flex items-center justify-between gap-2 bg-black/20 border border-white/10 rounded px-2 py-2 text-white/90 hover:bg-white/10"
      title={
        health.status === 'offline'
          ? `Sin conexión. Click para reintentar. ${health.lastError || ''}`
          : `Conexión: ${health.status}. Click para refrescar.`
      }
    >
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-xs font-bold">BD</span>
        <span className="text-[10px] text-white/70">
          {health.status === 'online' ? 'ONLINE' : health.status === 'waking' ? 'DESPERTANDO' : 'OFFLINE'}
        </span>
      </div>
      {health.status === 'online' ? <Wifi size={14} /> : <WifiOff size={14} />}
    </button>
  );
};

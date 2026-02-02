import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wifi, WifiOff, Database, AlertCircle } from 'lucide-react';

export default function StatusBar() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbStatus, setDbStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>('CONNECTING');

  useEffect(() => {
    // 1. Monitor de Internet
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Monitor de Base de Datos (Realtime)
    const channel = supabase.channel('ping');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setDbStatus('CONNECTED');
      else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setDbStatus('DISCONNECTED');
      else setDbStatus('CONNECTING');
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex gap-3 bg-dark/50 px-3 py-1 rounded-full border border-gray-800 text-[10px] font-bold">
      {/* Icono Internet */}
      <div className={`flex items-center gap-1 ${isOnline ? 'text-green-500' : 'text-red-500 animate-pulse'}`}>
        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
        <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
      </div>

      <div className="w-px bg-gray-700"></div>

      {/* Icono Base de Datos */}
      <div className={`flex items-center gap-1 ${dbStatus === 'CONNECTED' ? 'text-blue-500' : 'text-yellow-500 animate-pulse'}`}>
        {dbStatus === 'CONNECTED' ? <Database size={14} /> : <AlertCircle size={14} />}
        <span>{dbStatus === 'CONNECTED' ? 'DB OK' : 'DB...'}</span>
      </div>
    </div>
  );
}
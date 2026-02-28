import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProgram } from '../context/ProgramContext';
import { fetchNotices, activeNotices } from '../api/notices';

export const NoticesBanner = () => {
  const { programGroup } = useProgram();

  const { data } = useQuery({
    queryKey: ['avisos', programGroup],
    queryFn: () => fetchNotices(programGroup),
    staleTime: 30_000,
  });

  const items = useMemo(() => activeNotices(data), [data]);
  if (!items.length) return null;

  const hasCritical = items.some((i) => i.severity === 'CRITICAL');
  const hasWarning = items.some((i) => i.severity === 'WARNING');

  const color = hasCritical
    ? 'bg-red-50 border-red-300 text-red-800'
    : hasWarning
    ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
    : 'bg-blue-50 border-blue-200 text-blue-800';

  const dot = hasCritical ? 'bg-red-600' : hasWarning ? 'bg-yellow-600' : 'bg-blue-600';

  return (
    <Link
      to="/notices"
      className={`block border rounded px-3 py-2 text-xs font-bold ${color} hover:opacity-90`}
      title="Clic para ver avisos"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <span>AVISOS ({items.length})</span>
        <span className="text-[10px] opacity-70">— {programGroup}</span>
      </div>
      <div className="text-[11px] mt-1 font-normal">
        Último: <span className="font-bold">{items[0].title}</span> —{' '}
        {items[0].message.slice(0, 120)}
        {items[0].message.length > 120 ? '…' : ''}
      </div>
    </Link>
  );
};

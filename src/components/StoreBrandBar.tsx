import clsx from 'clsx';
import { Pizza } from 'lucide-react';
import { getConfigCache } from '../lib/configCache';

type Props = {
  cfg?: any;
  tone?: 'light' | 'dark';
  className?: string;
};

export default function StoreBrandBar({ cfg, tone = 'light', className }: Props) {
  const c = cfg ?? getConfigCache();

  const name = String(c?.nombre_tienda ?? '');
  const slogan = String(c?.store_slogan ?? c?.slogan ?? '');
  const logoUrl = String(c?.logo_url ?? '');

  if (!name && !slogan && !logoUrl) return null;

  const isDark = tone === 'dark';

  return (
    <div className={clsx('w-full', className)}>
      <div className={clsx('flex items-center gap-3 py-2', isDark ? 'text-white' : 'text-gray-900')}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name || 'Logo'}
            className="h-9 sm:h-10 w-auto object-contain rounded-sm"
            loading="lazy"
          />
        ) : (
          <div
            className={clsx(
              'h-9 sm:h-10 w-9 sm:w-10 rounded-md flex items-center justify-center',
              isDark ? 'bg-white/10' : 'bg-gray-100'
            )}
          >
            <Pizza className={clsx('h-5 w-5', isDark ? 'text-white' : 'text-gray-700')} />
          </div>
        )}

        <div className="min-w-0">
          {name && (
            <div className={clsx('font-semibold leading-tight', isDark ? 'text-white' : 'text-gray-900')}>
              {name}
            </div>
          )}
          {slogan && (
            <div className={clsx('text-xs sm:text-sm leading-tight truncate', isDark ? 'text-white/80' : 'text-gray-600')}>
              {slogan}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

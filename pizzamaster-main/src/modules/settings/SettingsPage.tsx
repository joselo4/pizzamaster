import { useState } from 'react';

import { SystemSettings } from './components/SystemSettings';
import { CentersManager } from './components/CentersManager';
import { UsersManager } from './components/UsersManager';
import { UserPermissionsManager } from './components/UserPermissionsManager';
import { FeatureFlagsManager } from './components/FeatureFlagsManager';
import { RationManager } from './components/RationManager';
import { KitManager } from './components/KitManager';
import { PecosaSettings } from './components/PecosaSettings';
import { GlobalSettings } from './components/GlobalSettings';
import { AuditLogViewer } from './components/AuditLogViewer';

const tabs = [
  { key: 'centers', label: 'Centros / Benef.', comp: CentersManager },
  { key: 'system', label: 'Sistema / Logs', comp: SystemSettings },
  { key: 'users', label: 'Usuarios', comp: UsersManager },
  { key: 'rbac', label: 'Permisos (RBAC)', comp: UserPermissionsManager },
  { key: 'flags', label: 'Flags', comp: FeatureFlagsManager },
  { key: 'ration', label: 'Nutrición', comp: RationManager },
  { key: 'kits', label: 'Kits', comp: KitManager },
  { key: 'pecosa', label: 'PECOSA', comp: PecosaSettings },
  { key: 'sign', label: 'Firmas', comp: GlobalSettings },
  { key: 'audit', label: 'Auditoría', comp: AuditLogViewer },
];

export const SettingsPage = () => {
  const [active, setActive] = useState('centers');
  const ActiveComp: any = (tabs.find(t => t.key === active)?.comp) ?? CentersManager;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="bg-white p-4 rounded shadow border-l-4 border-gray-800">
        <h2 className="text-xl font-bold text-gray-800">Configuración</h2>
        <p className="text-xs text-gray-500">Módulos enlazados (quirúrgico). Accesos dependen de rol/permisos.</p>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <div className="p-2 border-b flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`px-3 py-2 rounded text-xs font-bold ${active === t.key ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          <ActiveComp />
        </div>
      </div>
    </div>
  );
};

import { useProgram } from '../../core/context/ProgramContext';

// PCA/OLLAS
import { PcaBatchDistribution } from '../pca/components/PcaBatchDistribution';
// PANTBC
import { PantbcDistribution } from '../pantbc/components/PantbcDistribution';

// Distribución unificada: abre en todos los programas sin romper flujos
export const DistributionPage = () => {
  const { programGroup } = useProgram();
  if (programGroup === 'PANTBC') return <PantbcDistribution />;
  return <PcaBatchDistribution />;
};

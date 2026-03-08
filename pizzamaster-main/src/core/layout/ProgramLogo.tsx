import { useProgram, getProgramLabel } from '../context/ProgramContext';

export const ProgramLogo = () => {
  const { program, programGroup } = useProgram();

  const map: any = {
    PCA_COM: { label: 'PCA', sub: 'Comedores' },
    PCA_HOG: { label: 'PCA', sub: 'Hogares y Albergues' },
    PCA_RSK: { label: 'PCA', sub: 'Personas en Riesgo' },
    PANTBC: { label: 'PANTBC', sub: 'TBC' },
    OLLAS: { label: 'OLLAS', sub: 'Ollas Comunes' },
    PCA: { label: 'PCA', sub: 'Comedores' },
  };

  const fallback = programGroup === 'PANTBC' ? map.PANTBC : programGroup === 'OLLAS' ? map.OLLAS : map.PCA;
  const cfg = map[program] ?? fallback;

  return (
    <div className="text-white">
      <div className="text-[10px] font-black tracking-widest opacity-90">SISTEMA {cfg.label}</div>
      <div className="text-xs font-bold opacity-95">{cfg.sub}</div>
      <div className="text-[10px] opacity-70">Muni. Andahuaylas</div>
    </div>
  );
};

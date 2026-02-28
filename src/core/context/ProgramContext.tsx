import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { setTelemetryContext } from '../services/telemetry';

// ProgramType: valor fino usado para filtrar datos (program_id en BD es TEXT)
export type ProgramType =
  | 'PCA' | 'PANTBC' | 'OLLAS'
  | 'PCA_COM' | 'PCA_HOG' | 'PCA_RSK' | 'PCA_ATW';

export type ProgramGroup = 'PCA' | 'PANTBC' | 'OLLAS';

const groupOf = (p: ProgramType): ProgramGroup => {
  if (p === 'PANTBC') return 'PANTBC';
  if (p === 'OLLAS') return 'OLLAS';
  return 'PCA'; // incluye PCA + PCA_*
};

export const PROGRAM_LABELS: Record<string, string> = {
  PCA_COM: 'PCA-Comedores Populares',
  PCA_HOG: 'PCA-Hogares y Albergues',
  PCA_RSK: 'PCA-Personas en Riesgo',
  PCA_ATW: 'PCA-Alimentos por Trabajo',
  PANTBC: 'PANTBC (Salud)',
  OLLAS: 'Ollas Comunes',
  PCA: 'PCA-Comedores Populares',
};

export const getProgramLabel = (p: string) => PROGRAM_LABELS[p] ?? p;

interface ProgramContextType {
  program: ProgramType;       // valor fino
  programId: string;          // alias histórico = program
  programGroup: ProgramGroup; // valor macro
  programName: string;       // nombre amigable para UI
  switchProgram: (p: ProgramType) => void;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export const ProgramProvider = ({ children }: { children: ReactNode }) => {
  const [program, setProgramState] = useState<ProgramType>('PCA_COM');

  useEffect(() => {
    try { setTelemetryContext({ program_id: program }); } catch {}
  }, [program]);

  const switchProgram = (newProgram: ProgramType) => {
    setProgramState(newProgram);
    try { setTelemetryContext({ program_id: newProgram }); } catch {}
  };

  return (
    <ProgramContext.Provider value={{
      program,
      programId: program,
      programGroup: groupOf(program),
      programName: getProgramLabel(program),
      switchProgram,
    }}>
      {children}
    </ProgramContext.Provider>
  );
};

export const useProgram = () => {
  const context = useContext(ProgramContext);
  if (!context) throw new Error('useProgram must be used within a ProgramProvider');
  return context;
};

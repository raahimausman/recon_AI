'use client';

import { createContext, useContext, useState } from 'react';
import { ReconciliationMode } from '@/types/reconciliation';

interface SelectedModeContextType {
  selectedMode: ReconciliationMode | null;
  setSelectedMode: (mode: ReconciliationMode) => void;
  clearSelectedMode: () => void;
}

const SelectedModeContext = createContext<SelectedModeContextType | undefined>(undefined);

export function SelectedModeProvider({ children }: { children: React.ReactNode }) {
  const [selectedMode, setSelectedMode] = useState<ReconciliationMode | null>(null);

  const clearSelectedMode = () => setSelectedMode(null);

  return (
    <SelectedModeContext.Provider value={{ selectedMode, setSelectedMode, clearSelectedMode }}>
      {children}
    </SelectedModeContext.Provider>
  );
}

export function useSelectedMode() {
  const context = useContext(SelectedModeContext);
  if (!context) {
    throw new Error('useSelectedMode must be used within SelectedModeProvider');
  }
  return context;
}
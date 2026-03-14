"use client";
import React, { createContext, useContext, useState } from 'react';


const ReconciliationRunContext = createContext<{
  runId: string | null;
  setRunId: (id: string | null) => void;
}>({ runId: null, setRunId() {} });

export function ReconciliationRunProvider({ children }: { children: React.ReactNode }) {
  const [runId, setRunId] = useState<string | null>(null);
  return (
    <ReconciliationRunContext.Provider value={{ runId, setRunId }}>
      {children}
    </ReconciliationRunContext.Provider>
  );
}

export const useRunId = () => useContext(ReconciliationRunContext);
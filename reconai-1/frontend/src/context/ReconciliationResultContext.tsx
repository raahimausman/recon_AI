'use client';

import React, { createContext, useContext, useState } from 'react';

export interface GenericResult {
  /** whatever you need later (stats, rows, blob link, etc.). */
  meta: Record<string, any>;
  /** a parsed array of rows for the big table         */
  rows:  any[];
}

export interface ReconPayload {
  genericResults : GenericResult[];   // 1-N tables (3-way returns 2)
  downloadBlob   : Blob;              // file/zip from FastAPI
  downloadName   : string;            // default filename
}

interface Ctx {
  result: ReconPayload | null;
  setResult: (r: ReconPayload | null) => void;
}

const ReconciliationResultContext = createContext<Ctx | undefined>(undefined);

export function ReconciliationResultProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<ReconPayload | null>(null);
  return (
    <ReconciliationResultContext.Provider value={{ result, setResult }}>
      {children}
    </ReconciliationResultContext.Provider>
  );
}

export function useReconciliationResult() {
  const ctx = useContext(ReconciliationResultContext);
  if (!ctx) throw new Error('useReconciliationResult must be inside provider');
  return ctx;
}
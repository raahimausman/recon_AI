'use client';

import React, { createContext, useContext, useState } from 'react';
import { UploadedSource } from '@/types/source';

interface UploadedSourcesContextType {
  uploadedSources: UploadedSource[];
  setUploadedSources: (sources: UploadedSource[]) => void;
  clearUploadedSources: () => void;
}

const UploadedSourcesContext = createContext<UploadedSourcesContextType | undefined>(undefined);

export function UploadedSourcesProvider({ children }: { children: React.ReactNode }) {
  const [uploadedSources, setUploadedSources] = useState<UploadedSource[]>([]);

  const clearUploadedSources = () => setUploadedSources([]);

  return (
    <UploadedSourcesContext.Provider
      value={{
        uploadedSources,
        setUploadedSources,
        clearUploadedSources
      }}
    >
      {children}
    </UploadedSourcesContext.Provider>
  );
}

export function useUploadedSources() {
  const context = useContext(UploadedSourcesContext);
  if (!context) {
    throw new Error('useUploadedSources must be used within UploadedSourcesProvider');
  }
  return context;
}

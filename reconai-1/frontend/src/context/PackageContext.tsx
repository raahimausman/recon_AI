"use client";

import { createContext, useContext, useState } from 'react';

interface ParsedPackage {
  invoices: File[];
  proofs: File[];
  summary: File | null;
}

interface PackageValidation {
  valid: boolean;
  errors?: string[];
}

interface PackagePreview {
  parsedPackage: ParsedPackage;
  validation: PackageValidation;
}

interface PackageContextType {
  packageData: PackagePreview | null;
  setPackageData: (data: PackagePreview) => void;
  clearPackageData: () => void;
}

const PackageContext = createContext<PackageContextType | undefined>(undefined);

export function PackageProvider({ children }: { children: React.ReactNode }) {
  const [packageData, setPackageData] = useState<PackagePreview | null>(null);

  const clearPackageData = () => setPackageData(null);

  return (
    <PackageContext.Provider value={{ packageData, setPackageData, clearPackageData }}>
      {children}
    </PackageContext.Provider>
  );
}

export function usePackageData() {
  const context = useContext(PackageContext);
  if (!context) {
    throw new Error('usePackageData must be used within PackageProvider');
  }
  return context;
}
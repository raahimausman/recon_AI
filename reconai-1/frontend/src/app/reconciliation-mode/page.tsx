'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ModeCard from '@/components/reconciliation/ModeCard';
import BackButton from '@/components/BackButton';
import { useSelectedMode } from '@/context/SelectedModeContext';
import { useUploadedSources } from '@/context/UploadedSourcesContext';
import { RECONCILIATION_MODES } from '@/types/reconciliation';


export default function ReconciliationModePage() {
  const router = useRouter();
  const { setSelectedMode } = useSelectedMode();
  const { clearUploadedSources } = useUploadedSources();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selectedId) return;

    const mode = RECONCILIATION_MODES.find((m) => m.id === selectedId);
    if (mode) {
      clearUploadedSources(); 
      setSelectedMode(mode);
      router.push('/upload');
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 md:px-8 pt-4 pb-12">
      <BackButton />

      <h1 className="text-xl md:text-2xl font-bold text-center mb-12">
        Select Reconciliation Mode
      </h1>

      <div className="flex flex-col max-w-3xl mx-auto">
        {RECONCILIATION_MODES.map((mode) => (
          <ModeCard
            key={mode.id}
            title={mode.label}
            description={mode.description}
            enabled={true}
            selected={selectedId === mode.id}
            onSelect={() => setSelectedId(mode.id)}
          />
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <button
          onClick={handleContinue}
          disabled={!selectedId}
          className={`cursor-pointer px-8 py-3 border border-black rounded-lg text-white font-bold transition ${
            selectedId
              ? 'bg-[#059DC0] hover:bg-[#047a99]'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
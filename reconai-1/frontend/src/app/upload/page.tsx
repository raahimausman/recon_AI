'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FileUploader from '@/components/FileUploader';
import LoadingSpinner from '@/components/animations/LoadingSpinner';
import UploadedSourcesList from '@/components/sidepanel/UploadedSourcesList';
import type { SourceType } from '@/types/source';
import { useUploadedSources } from '@/context/UploadedSourcesContext';
import { useSelectedMode } from '@/context/SelectedModeContext';
import { DOC_TYPE_MAP } from '@/constants/docTypes';
import { classifyFiles } from '@/utils/api/classify';
import ValidationModal from '@/components/ValidationModal';
// Firebase Imports
import { useRef }             from 'react';          
import { useAuth }            from '@/context/AuthContext';   
import { addReconciliationDoc } from '@/lib/firebaseRuns'; 
import { useRunId } from '@/context/ReconciliationRunContext';


export default function SeparateUploadPage() {
  const router = useRouter();

  const user = useAuth();          // Firebase user or null (guest)
  
  const { setRunId } = useRunId();
  const runIdRef = useRef<string | null>(null); // remember runId once created

  const { selectedMode } = useSelectedMode();

  useEffect(() => {
    if (!selectedMode) {
      router.push('/reconciliation-mode');
    }
  }, [selectedMode, router]);

  if (!selectedMode) {
    return null;
  }

  const [modalBadFiles, setModalBadFiles] = useState<File[]>([]);

  const { uploadedSources, setUploadedSources } = useUploadedSources();

  // holds valid files that passed classification
  const [validatedFiles, setValidatedFiles] = useState<Record<SourceType, File[]>>({
    Invoice: [],
    'Proof of Payment': [],
    'Summary of Invoices': [],
    'Purchase Order': [],
    'Goods Receipt Note': [],
  });

  // holds files that failed classification so we can show them
  const [invalidFiles, setInvalidFiles] = useState<Record<SourceType, File[]>>({
    Invoice: [],
    'Proof of Payment': [],
    'Summary of Invoices': [],
    'Purchase Order': [],
    'Goods Receipt Note': [],
  });

  // Track which sources are loading
  const [loadingSources, setLoadingSources] = useState<Record<SourceType, boolean>>({
    "Invoice": false,
    "Proof of Payment": false,
    "Summary of Invoices": false,
    "Purchase Order": false,
    "Goods Receipt Note": false
  });

  // Track reupload mode
  const [reuploadingSources, setReuploadingSources] = useState<Record<SourceType, boolean>>({
    "Invoice": false,
    "Proof of Payment": false,
    "Summary of Invoices": false,
    "Purchase Order": false,
    "Goods Receipt Note": false
  });

  // Handle file upload
  const handleFilesAccepted = async (type: SourceType, files: File[]) => {
    setLoadingSources(prev => ({ ...prev, [type]: true }));

    try {
      // 1) Ask backend to classify
      const apiType = DOC_TYPE_MAP[type];
      const results = await classifyFiles(apiType, files);

      // 2) Split files into pass / fail
      const good: File[] = [];
      const bad: File[]  = [];

      results.forEach((r, idx) => {
        if (r.match) good.push(files[idx]);
        else         bad.push(files[idx]);
      });

      // 3) Persist
      setValidatedFiles(prev => ({ ...prev, [type]: good }));
      setInvalidFiles(prev   => ({ ...prev, [type]: bad   }));

      if (bad.length > 0) setModalBadFiles(bad);

      // 4) Update global context **only with good files**
      if (good.length > 0) {
          // Write only if we have at least one passing file
          updateUploadedSources(type, good);
        } else {
          // Remove the record altogether if nothing passed
          setUploadedSources(uploadedSources.filter(item => item.type !== type));
      }

      // 5) Turn off “re-upload” mode if everything now valid
      if (bad.length === 0) {
        setReuploadingSources(prev => ({ ...prev, [type]: false }));
      }
    } catch (err) {
      console.error(err);
      alert('Classification failed. Please try again.');
    } finally {
      setLoadingSources(prev => ({ ...prev, [type]: false }));
    }
  };

  // Update global uploaded sources context
  const updateUploadedSources = (type: SourceType, files: File[]) => {
    const filtered = uploadedSources.filter((item) => item.type !== type);
    setUploadedSources([...filtered, { type, files }]);
  };

  // Handle delete
  const handleDelete = (type: SourceType) => {
    setUploadedSources(uploadedSources.filter(item => item.type !== type));
    setReuploadingSources(prev => ({ ...prev, [type]: false }));
    setInvalidFiles(prev => ({ ...prev, [type]: [] }));
    setValidatedFiles(prev => ({ ...prev, [type]: [] }));
  };

  // Handle re-upload click
  const handleReUploadClick = (type: SourceType) => {
    setReuploadingSources(prev => ({ ...prev, [type]: true }));
    // clear current good files so they don't display alongside new ones
    setValidatedFiles(prev => ({ ...prev, [type]: [] }));
    setReuploadingSources(prev => ({ ...prev, [type]: true }));
    // Also remove from context
    setUploadedSources(uploadedSources.filter(item => item.type !== type));
  };

  const allRequiredUploaded = selectedMode.expectedSources.every(
    (t) => validatedFiles[t] && validatedFiles[t].length > 0 && invalidFiles[t].length === 0
  );

  const handleProceed = async () => {
    /* 1 ▸ persist VALIDATED files in the global context (existing logic) */
    const newSources = selectedMode.expectedSources.map((t) => ({
      type : t,
      files: validatedFiles[t],
    }));
    setUploadedSources(newSources);

    /* 2 ▸ create a “queued” Firestore doc exactly ONCE, only for logged-in users */
    if (!runIdRef.current) {
      runIdRef.current = await addReconciliationDoc(user, {
        mode     : selectedMode.id,   // "threeWay" | "twoWayPOGRN" …
        runLabel : '',                // you may surface an input later
      });
      setRunId(runIdRef.current);     // expose to the rest of the app
    }

    /* 3 ▸ navigate to /loading, forwarding runId (guests → no query-param) */
    const qs = runIdRef.current ? `?runId=${runIdRef.current}` : '';
    router.push('/loading' + qs);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      <ValidationModal badFiles={modalBadFiles} onClose={() => setModalBadFiles([])} />

      {/* Side Panel */}
      <div className="hidden md:block w-full md:w-72 border-r">
        <UploadedSourcesList sources={uploadedSources} />
      </div>

      {/* Main Content */}
      <div className="flex-1 py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold mb-16 text-center">
            Upload Files for: {selectedMode.label}
          </h1>

          {selectedMode.expectedSources.map((type) => (
            <div key={type} className="mb-6">
              {loadingSources[type] ? (
                <div className="flex flex-col items-center mt-4">
                  <LoadingSpinner size={36} />
                  <p className="mt-2 text-sm text-gray-600">
                    Processing {type} files...
                  </p>
                </div>
              ) : reuploadingSources[type] ? (
                <FileUploader
                  label={`Upload files for ${type}`}
                  sourceType={type}
                  onFilesAccepted={(files) => handleFilesAccepted(type, files)}
                />
              ) : validatedFiles[type] && validatedFiles[type].length > 0 ? (
                <div className="flex items-center justify-between border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">
                      Files uploaded for {type}:
                    </p>
                    <ul className="list-disc ml-4 text-sm text-gray-700">
                      {validatedFiles[type].map((file, idx) => (
                        <li key={idx}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex-shrink-0 flex gap-2 ml-4">
                    <button
                      onClick={() => handleDelete(type)}
                      className="cursor-pointer px-3 py-2 text-sm text-white font-semibold border border-black rounded-lg text-red-600 bg-red-600"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleReUploadClick(type)}
                      className="cursor-pointer px-3 py-2 text-sm border border-black rounded-lg text-white font-semibold bg-[#059DC0] "
                    >
                      Re-upload
                    </button>
                  </div>
                </div>
              ) : (
                <FileUploader
                  label={`Upload files for ${type}`}
                  sourceType={type}
                  onFilesAccepted={(files) => handleFilesAccepted(type, files)}
                />
              )}
            </div>
          ))}

          <div className="mt-16 flex justify-center">
            <button
              onClick={handleProceed}
              disabled={!allRequiredUploaded}
              className={`cursor-pointer px-8 py-3 border border-black rounded-lg text-white font-bold transition ${
                allRequiredUploaded
                  ? 'bg-[#059DC0] hover:bg-[#047a99]'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Run Reconciliation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

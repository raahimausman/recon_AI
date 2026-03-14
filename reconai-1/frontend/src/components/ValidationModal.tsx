'use client';
import { createPortal } from 'react-dom';
import { FaTimesCircle } from 'react-icons/fa';
import { useEffect, useState } from 'react';

interface Props {
  badFiles: File[];
  onClose: () => void;
}

export default function ValidationModal({ badFiles, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || badFiles.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-red-700 flex gap-2">
            <FaTimesCircle /> {badFiles.length} file
            {badFiles.length > 1 ? 's' : ''} failed type check
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-gray-500 hover:text-gray-700 text-xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <ul className="list-disc border border-gray-400 rounded-lg p-2 text-sm text-red-600 mb-4 max-h-40 overflow-y-auto">
          {badFiles.map(f => (
            <li key={f.name}>{f.name}</li>
          ))}
        </ul>
        <p className="text-xs text-gray-700">
          Only files matching the expected type are accepted. Please remove or re-upload.
        </p>
      </div>
    </div>,
    document.body
  );
}
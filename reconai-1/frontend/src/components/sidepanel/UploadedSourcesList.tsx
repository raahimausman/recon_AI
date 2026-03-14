'use client';

import React from 'react';

type SourceType =
  | 'Invoice'
  | 'Proof of Payment'
  | 'Summary of Invoices'
  | 'Purchase Order'
  | 'Goods Receipt Note';

interface UploadedSource {
  type: SourceType;
  files: File[];
}

interface UploadedSourcesListProps {
  sources: UploadedSource[];
}

export default function UploadedSourcesList({ sources }: UploadedSourcesListProps) {
  if (sources.length === 0) {
    return (
      <aside className="pl-6 pr-8 py-8 w-full md:w-72">
        <h2 className="text-lg font-semibold mb-4">Uploaded Sources</h2>
        <p className="text-sm text-gray-500">No sources added yet.</p>
      </aside>
    );
  }

  return (
    <aside className="pl-6 pr-8 py-8 w-full md:w-72 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Uploaded Sources</h2>
      <ul className="space-y-4">
        {sources.map((source, index) => (
          <li
            key={index}
            className="border border-gray-300 rounded-md p-4 bg-white shadow-sm"
          >
            <h3 className="font-medium text-[#059DC0] mb-2">
              Source {index + 1}: {source.type}
            </h3>
            <ul className="list-disc list-inside text-sm text-gray-700">
              {source.files.map((file, fileIndex) => (
                <li key={fileIndex}>{file.name}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  );
}
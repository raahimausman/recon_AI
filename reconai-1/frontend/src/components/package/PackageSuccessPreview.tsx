'use client';

import React from 'react';
import { FaCheckCircle } from 'react-icons/fa';

interface Props {
  invoices: File[];
  proofs: File[];
  summary: File;
  onRun: () => void;
}

export default function PackageSuccessPreview({ invoices, proofs, summary, onRun }: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-black mb-8 text-center">
        Package Preview
      </h2>

      <div className='flex flex-col gap-4 p-6 border border-[#059DC0] rounded-lg shadow'>
        <div className="mb-6">
        <p className="text-green-700 font-medium mb-2 flex items-center gap-2">
          <FaCheckCircle className="text-green-500" />
          invoices/ folder found ({invoices.length} files)
        </p>
        <ul className="list-disc ml-6 text-gray-700">
          {invoices.map((file, idx) => (
            <li key={idx}>{file.name}</li>
          ))}
        </ul>
       </div>

        <div className="mb-6">
            <p className="text-green-700 font-medium mb-2 flex items-center gap-2">
            <FaCheckCircle className="text-green-500" />
            proof_of_payments/ folder found ({proofs.length} files)
            </p>
            <ul className="list-disc ml-6 text-gray-700">
            {proofs.map((file, idx) => (
                <li key={idx}>{file.name}</li>
            ))}
            </ul>
        </div>

        <div className="mb-6">
            <p className="text-green-700 font-medium mb-2 flex items-center gap-2">
            <FaCheckCircle className="text-green-500" />
            Summary file found: 
            <span className='text-gray-700'>{summary.name}</span>
            </p>
        </div>
      </div>

      <div className="flex justify-center my-8">
        <button
          onClick={onRun}
          className="cursor-pointer bg-[#059DC0] text-white font-bold border border-black px-8 py-3 rounded-lg hover:bg-[#047a99] transition"
        >
          Run Reconciliation
        </button>
      </div>
    </div>
  );
}
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  errors: string[];
}

export default function PackageErrorPreview({ errors }: Props) {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-6 pt-4 pb-6">

      <h2 className="text-2xl font-bold text-black mb-8 text-center">
        Invalid Package Structure
      </h2>
      
      <div className='flex flex-col p-6 bg-red-50 border border-red-400 rounded-lg shadow'>

        <p className="text-red-700 mb-6">
        Your uploaded ZIP file doesn't match the expected format.
        </p>

        <ul className="list-disc ml-6 text-red-800 mb-6">
          {errors.map((err, idx) => (
            <li key={idx}>{err}</li>
          ))}
        </ul>

        <div className="mb-4">
          <p className="text-gray-700 font-medium">Expected Structure:</p>
          <ul className="list-disc ml-6 text-gray-700">
            <li>invoices/ folder with PDF files</li>
            <li>proof_of_payments/ folder with PDF files</li>
            <li>a summary .xlsx file at the root level</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-center mt-6">
        <button
          onClick={() => router.push('/upload/package')}
          className="cursor-pointer bg-[#059DC0] text-white font-semibold border border-black px-6 py-3 rounded-lg hover:bg-[#047a99] transition"
        >
          Back to Upload
        </button>
      </div>
    </div>
  );
}
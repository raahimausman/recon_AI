'use client';

import BackButton from '@/components/BackButton';
import FileDropZone from '@/components/FileDropZone';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePackageData } from '@/context/PackageContext';
import { parseZip } from '@/utils/parseZip';
import LoadingSpinner from '@/components/animations/LoadingSpinner';

export default function PackageUploadPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  
  const { setPackageData } = usePackageData();

  const handleFileAccepted = async (file: File) => {
      try {
        setLoading(true);
        const result = await parseZip(file);
        setPackageData(result);
        router.push('/upload/package/preview');
      } catch (error) {
        console.error('Error parsing zip:', error);
        alert('Failed to process the uploaded ZIP file.');
        setLoading(false);
      }
  };


  return (
    <div className="relative min-h-screen bg-white flex flex-col">

      <BackButton />

      <main className="flex flex-col items-center pt-12 px-4">
        <h2 className="text-xl md:text-2xl font-semibold mb-12 text-center">
          Upload or drag-and-drop your package here
        </h2>

        {loading ? (
            <div className="flex flex-col items-center mt-12">
              <LoadingSpinner size={48} />
              <p className="mt-4 text-sm text-gray-600">
                Processing your package. Please wait...
              </p>
            </div>
          ) : (
            <>
              <FileDropZone onFileAccepted={handleFileAccepted} />
              <p className="text-sm text-gray-600 mt-14 text-center">
                Ensure that your package contains subfolders for invoices and payment proofs, with all files in PDF format.
              </p>
            </>
        )}
      </main>
    </div>
  );
}
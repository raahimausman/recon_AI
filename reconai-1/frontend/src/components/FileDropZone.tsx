'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';

export default function FileDropZone({ onFileAccepted }: { onFileAccepted: (file: File) => void }) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileAccepted(acceptedFiles[0]);
    }
  }, [onFileAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
    onDrop,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed border-[#059DC0] rounded-lg p-8 w-64 h-48 md:w-96 flex flex-col items-center justify-center cursor-pointer transition ${
        isDragActive ? 'bg-[#E0F7FA]' : 'bg-white'
      }`}
    >
      <input {...getInputProps()} />

      <Image
        src="/assets/upload-vector.png"
        alt="Upload Icon"
        width={64}
        height={64}
        className="mb-4"
      />

      <p className="text-center text-sm font-medium text-gray-700">
        Supported Format: ZIP File
      </p>
    </div>
  );
}
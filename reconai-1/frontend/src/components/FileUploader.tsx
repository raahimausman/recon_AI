'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';

type FileUploaderProps = {
  onFilesAccepted: (files: File[]) => void;
  label?: string;
  sourceType?: string;
};

export default function FileUploader({ onFilesAccepted, label = 'Upload Files', sourceType }: FileUploaderProps) {
  // Decide accepted types and message
  let accept;
  let supportedFormatsText;

  if (sourceType?.toLowerCase().includes('summary')) {
    accept = {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    };
    supportedFormatsText = "Supported Formats: CSV, XLSX.";
  } else {
    accept = {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    };
    supportedFormatsText = "Supported Formats: PDF, PNG, or JPEG.";
  }

  // Determine if multiple uploads are allowed
  let allowMultiple = true;
  if (sourceType === 'Purchase Order' || sourceType === 'Goods Receipt Note' || sourceType === 'Summary of Invoices') {
    allowMultiple = false;
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesAccepted(acceptedFiles);
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple: allowMultiple,
    onDrop
  });

  return (
    <div className="flex flex-col items-center my-16">
      <h2 className="text-lg font-semibold mb-4 text-center">
        {label}
      </h2>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed border-[#059DC0] rounded-lg p-10 w-full max-w-xl flex flex-col items-center justify-center cursor-pointer transition ${
          isDragActive ? 'bg-blue-50' : 'bg-white'
        }`}
      >
        <input {...getInputProps()} />

        <Image
          src="/assets/upload-vector-2.png"
          alt="Upload Icon"
          width={32}
          height={32}
          className="mb-4"
        />

        <p className="text-center text-sm font-medium text-gray-700">
          {supportedFormatsText}
        </p>
        <p className="text-center text-xs text-gray-500 mt-1">
          {allowMultiple ? 'Multiple files can be uploaded.' : 'Only one file can be uploaded.'}
        </p>
      </div>
    </div>
  );
}

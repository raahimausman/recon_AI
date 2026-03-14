"use client";

import IngestionOptionCard from '@/components/ingestion/IngestionOptionCard';
import BackButton from '@/components/BackButton';
import HelpButton from '@/components/HelpButton';
import { useRouter } from 'next/navigation';

export default function IngestionPage() {

  const router = useRouter();
  
  const handlePackageZip = () => {
    router.push('/upload/package');
  };

  const handleSeparateFiles = () => {
    router.push('/reconciliation-mode');
  };

  return (
    <div className="relative min-h-screen bg-white flex flex-col">

      <BackButton />

      <main className="flex flex-col flex-grow justify-start items-center py-8">
        <h2 className="text-xl md:text-2xl font-semibold mb-12 text-center px-4">
          How do you want to bring your data into Recon AI?
        </h2>

        <div className="flex flex-col md:flex-row items-center justify-center border-2 border-dashed border-[#059DC0] rounded-xl px-6 py-8 md:p-12 space-y-6 md:space-y-0 md:space-x-12">

          <div className="flex flex-col items-center">
            <IngestionOptionCard
              title="Package ZIP"
              icon="/assets/package-vector.png"
              onClick={handlePackageZip}
            />
            <p className='text-xs mt-4 text-center w-60'>Upload one zipped folder containing invoices/, proofs/, and a "summary.xlsx".</p>
          </div>

          <span className="text-xl font-semibold text-gray-500">Or</span>

          <div className="flex flex-col items-center">
            <IngestionOptionCard
                title="Separate Files"
                icon={"/assets/files-vector.png"}
                onClick={handleSeparateFiles}
            />
            <p className='text-xs mt-4 text-center w-60'>Upload individual CSV, XLSX, PDF or image files and choose what each file represents.</p>
          </div>

        </div>
      </main>

      <HelpButton />
    </div>
  );
}
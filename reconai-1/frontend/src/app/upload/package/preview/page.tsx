'use client';

import { usePackageData } from '@/context/PackageContext';
import { useRouter } from 'next/navigation';
import PackageSuccessPreview from '@/components/package/PackageSuccessPreview';
import PackageErrorPreview from '@/components/package/PackageErrorPreview';
import BackButton from '@/components/BackButton';

export default function PackagePreviewPage() {
  const router = useRouter();
  const { packageData, clearPackageData } = usePackageData();

  if (!packageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">No package data found</h2>
          <button
            onClick={() => router.push('/package')}
            className="bg-[#059DC0] text-white px-6 py-3 rounded-lg hover:bg-[#047a99] transition"
          >
            Go Back to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-4 pb-8 px-4">
      <BackButton />

      <main className="max-w-5xl mx-auto">
        {packageData.validation.valid ? (
          <PackageSuccessPreview
            invoices={packageData.parsedPackage.invoices}
            proofs={packageData.parsedPackage.proofs}
            summary={packageData.parsedPackage.summary!}
            onRun={() => {
              clearPackageData();
              router.push('/package/reconciliation-mode');
            }}
          />
        ) : (
          <PackageErrorPreview errors={packageData.validation.errors ?? []} />
        )}
      </main>
    </div>
  );
}
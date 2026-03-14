'use client';
import { IoArrowBack } from 'react-icons/io5';
import { useRouter }   from 'next/navigation';
import { generateAndDownloadReport } from '@/lib/report-generation/reportDownload';
import { useAuth }           from '@/context/AuthContext';

export interface ResultsHeaderProps {
  modeLabel    : string;
  description ?: string;
  completedAt  : Date;
  /* new ↓ */
  downloadUrl  : string;
  downloadName : string;
  onGenerateInsights: () => void;        // ← new
  downloading?: boolean;
}

export default function ResultsHeader({
  modeLabel,
  description,
  completedAt,
  downloadUrl,
  downloadName,
  onGenerateInsights,
  downloading
}: ResultsHeaderProps) {
  const router = useRouter();

  const user = useAuth();  // Firebase user (or null)

  async function handleDownload() {
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Failed to fetch report');
    const blob = await response.blob();
    await generateAndDownloadReport(modeLabel, blob);
    } catch (e: any) {
    alert(e?.message ?? 'Report generation failed');
  }
}

  return (
    <>
      <button
        onClick={() => router.push(user ? '/dashboard' : '/')}
        className="cursor-pointer text-black text-3xl px-0 pt-4 pb-6 md:pt-6 md:pb-2 focus:outline-none"
        aria-label="Back"
      >
        <IoArrowBack size={32} />
      </button>

      <div className="flex flex-col md:flex-row justify-between items-center md:items-center mb-16">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mt-4">Reconciliation Results</h1>
          <h2 className="text-lg text-[#047299] md:text-xl font-bold mt-2">
            {modeLabel}
          </h2>
          {description && (
            <p className="text-sm text-gray-600 mt-2">{description}</p>
          )}
          <p className="text-sm text-gray-500 mt-4">
            Completed on:&nbsp;
            {completedAt.toLocaleString('en-US', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </p>
        </div>

        <div className='flex flex-row items-center mt-4 md:mt-0 gap-x-4'>
          <button
            onClick={onGenerateInsights}
            className="cursor-pointer mt-4 bg-[#dca62f] text-white font-semibold
                      border border-black rounded-lg px-4 py-2 text-sm"
            disabled={downloading}
          >
            {downloading ? 'Generating…' : 'Generate AI Insights'}
          </button>

          <button
            onClick={handleDownload}
            className="cursor-pointer mt-4 bg-[#059DC0] text-white font-semibold border border-black
                  rounded-lg px-4 py-2 text-sm"
            >
            Download Report
          </button>
        </div>

      </div>
    </>
  );
}

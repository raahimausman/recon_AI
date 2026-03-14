'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter }   from 'next/navigation';
import scrollIntoView  from 'scroll-into-view-if-needed';
import JSZip          from 'jszip';

import { useReconciliationResult } from '@/context/ReconciliationResultContext';
import ResultsHeader   from '@/components/results/ResultsHeader';
import ResultsOverview from '@/components/results/ResultsOverview';
import ResultsTable    from '@/components/results/ResultsTable';
import AISummaryBox    from '@/components/results/AISummaryBox';

import { fetchInsight } from '@/utils/api/insight';             // helper we created
import type { ReconModeId } from '@/utils/api/endpoints';

import { useAuth }    from '@/context/AuthContext';
import { updateRun }  from '@/lib/firebaseRuns';
import { useSearchParams } from 'next/navigation';

/* ------------------------------------------------------------------ */

export default function ResultPage() {
  const { result } = useReconciliationResult();
  const router     = useRouter();

  const user = useAuth();                  // Firebase user (or null)
  const params = useSearchParams();
  const runId = params.get('runId');       // null when guest flow

  /* ── guard: no data, bounce home ─────────────────── */
  useEffect(() => {
    if (!result) router.replace('/');
  }, [result, router]);
  if (!result) return null;

  /* ── state for AI Insight panel ──────────────────── */
  const [aiMarkdown, setAiMarkdown] = useState<string>();
  const [aiLoading , setAiLoading ] = useState(false);
  const [aiError   , setAiError   ] = useState<string|null>(null);
  const insightRef = useRef<HTMLDivElement>(null);

  /* ── convenience handles from context result ─────── */
  const { genericResults, downloadBlob, downloadName } = result;
  const url  = URL.createObjectURL(downloadBlob);
  const meta = genericResults[0].meta;            // drives header / overview
  console.log(meta)

  /* -------------------------------------------------- */
  async function handleGenerateInsights() {
    console.log('clicked')
    setAiMarkdown(undefined);
    setAiError(null);
    setAiLoading(true);

    try {
      let md = '';

      /* Which reconciliation mode?  We stored it in meta.modeId */
      const modeId = meta.modeId as ReconModeId;

      if (modeId === 'threeWay') {
        // 1. Load the ZIP from downloadBlob
        const zip = await JSZip.loadAsync(downloadBlob);

        // 2. Extract the required files by name
        const { invoiceFile, chequeFile } = meta.zipParts;

        // 3. Get the file data as Blob
        const invoiceBlob = await zip.file(invoiceFile)?.async('blob');
        const chequeBlob  = await zip.file(chequeFile )?.async('blob');

        if (!invoiceBlob || !chequeBlob) throw new Error('Could not extract files from ZIP');

        // 4. Create File objects
        const invoice = new File([invoiceBlob], invoiceFile);
        const cheque  = new File([chequeBlob ], chequeFile );

        // 5. Call fetchInsight for each
        const md1 = await fetchInsight(invoice, 'INVOICE');
        const md2 = await fetchInsight(cheque , 'CHEQUE' );
        md = `${md1}\n\n---\n\n${md2}`;
      } else {
        /* ── single Excel sheet ─────────────────────────── */
        const file = new File([downloadBlob], downloadName);
        md = await fetchInsight(file);
        
      }
      
      /* ① — update local UI */
      setAiMarkdown(md);
      /* scroll into view */
      setTimeout(() => {
        if (insightRef.current) {
          scrollIntoView(insightRef.current, { behavior: 'smooth', block: 'start' });
        }
      }, 50);

      /* ② — persist to Firestore (skips if guest) */
      await updateRun(user, runId ?? null, {
        insightMd:     md,
        markCompleted: false,         // leave timestamps untouched
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setAiError(e?.message || 'Insight generation failed');
    } finally {
      setAiLoading(false);
    }
  };


  function getTableTitle(modeLabel: string, idx: number): string {
    if (modeLabel === 'Invoice ↔ Proof ↔ Summary (Invoices Sheet)') {
      return idx === 0
        ? 'Invoice Reconciliation Table'
        : idx === 1
        ? 'Cheque Utilization Table'
        : '';
    }
    else {
      return 'Detailed Reconciliation Table'
    }
  }

  /* ── UI ──────────────────────────────────────────── */
  return (
    <div className="flex flex-col justify-start items-start gap-4 md:px-8 pb-12">
      {/* LEFT – header, overview, tables */}
      <div className="flex-1 min-h-screen bg-white px-4 pt-2 pb-6">
        <ResultsHeader
          modeLabel   ={meta.modeLabel   || 'Reconciliation'}
          description ={meta.description || ''}
          completedAt ={meta.generatedOn}
          downloadUrl ={url}
          downloadName={downloadName}
          onGenerateInsights={handleGenerateInsights}
          downloading={aiLoading}
        />

        {meta.stats && <ResultsOverview stats={meta.stats}/>}

        {genericResults.map((gr, idx) => (
          <ResultsTable
            key={idx}
            rows={gr.rows}
            title={getTableTitle(meta.modeLabel, idx)}
          />
        ))}
      </div>

      {/* RIGHT – AI panel */}
      {aiMarkdown && (
        <div ref={insightRef}>
          <AISummaryBox
        markdown={aiMarkdown}
        isLoading={aiLoading}
        error={aiError}
          />
        </div>
      )}

    </div>
  );
}

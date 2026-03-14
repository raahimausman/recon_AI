/*  app/(wizard)/loading/page.tsx  */
'use client';

import { useEffect, useState }   from 'react';
import { useRouter }             from 'next/navigation';
import LoadingSpinner            from '@/components/animations/LoadingSpinner';

import { useUploadedSources }    from '@/context/UploadedSourcesContext';
import { useSelectedMode }       from '@/context/SelectedModeContext';
import { ReconPayload, useReconciliationResult } from '@/context/ReconciliationResultContext';

import { runReconciliation }     from '@/utils/api/reconcile';
import { toGeneric }             from '@/lib/report-generation/genericAdapters';
import type { ReconModeId }      from '@/utils/api/endpoints';
import type { SourceType }       from '@/types/source';

/* ——— Excel / ZIP parsers ——— */
import { parseThreeWayZip          } from '@/lib/report-generation/parseThreeWayZip';
import { parseThreeWayInvoiceExcel, generateThreeWayInvoiceReport }  from '@/lib/report-generation/generateThreeWayInvoiceReport';
import { parseChequeUtilizationExcel, generateChequeUtilizationReport }from '@/lib/report-generation/generateChequeUtilizationReport';
import { parseInvoiceSummaryExcel, generateInvoiceSummaryReport } from '@/lib/report-generation/generateInvoiceSummaryReport';
import { parseProofSummaryExcel, generateProofSummaryReport    } from '@/lib/report-generation/generateProofSummaryReport';
import { parsePOGrnExcel, generatePOGrnReport           } from '@/lib/report-generation/poGrnReport';

/* ——— Firebase Utility Functions ——— */
import { useSearchParams }   from 'next/navigation';
import { useAuth }           from '@/context/AuthContext';
import { updateRun }         from '@/lib/firebaseRuns';
import { uploadPdfToCloudinary, buildPageUrls } from '@/utils/uploadToCloudinary';

import { ThreeWayInvoiceReportData, ChequeUtilizationReportData, InvoiceSummaryReportData, ProofSummaryReportData, POGrnReportData } from '@/types/reconciliation';

import { captureNextPdfDownload } from '@/lib/pdf/captureDownloadBlob';

import JSZip                        from 'jszip';
import { mergePdfBlobs }            from '@/lib/pdf/mergePdfs';

const PARSERS: Record<
  ReconModeId,
  (blob: Blob) => Promise<unknown>        // raw report(s)
> = {
  threeWay               : parseThreeWayZip,             // returns GenericResult[]
  twoWayInvoiceSummary   : async (b) =>
    parseInvoiceSummaryExcel(new File([b], 'inv-sum.xlsx', { type: b.type })),
  twoWayProofSummary     : async (b) =>
    parseProofSummaryExcel  (new File([b], 'proof-sum.xlsx', { type: b.type })),
  twoWayPOGRN            : async (b) =>
    parsePOGrnExcel         (new File([b], 'po-grn.xlsx',  { type: b.type })),
};

/* ——————————————————————————————————————————————— */

export default function ReconciliationLoadingPage() {
  const router                 = useRouter();

  const user = useAuth();                        // Firebase user or null
  const params        = useSearchParams();                // read ?runId=…
  const runId         = params.get('runId');              // string | null


  const { uploadedSources }    = useUploadedSources();
  const { selectedMode }       = useSelectedMode();
  const { setResult }          = useReconciliationResult();

  /* animated text */
  const steps = [
    'Processing your uploaded data files…',
    'Extracting relevant information…',
    'Analyzing records…',
    'Running reconciliation…',
    'Finalising results…',
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i < steps.length - 1 ? i + 1 : i)), 1200);
    return () => clearInterval(t);
  }, []);

  /* kick-off exactly once */
  useEffect(() => {
    if (!selectedMode) {
      router.replace('/');
      return;
    }

    /* build payload for runReconciliation */
    const payload = selectedMode.expectedSources.reduce<Record<SourceType, File[]>>(
      (acc, t) => {
        const f = uploadedSources.find((u) => u.type === t)?.files ?? [];
        acc[t]  = f;
        return acc;
      },
      {} as Record<SourceType, File[]>,
    );

    (async () => {
      try {

        /* A ▸ set status = processing as soon as we enter */
        await updateRun(user, runId, { status: 'processing' });

        /* 1 — run FastAPI job  */
        const { blob, filename } = await runReconciliation(
          selectedMode.id as ReconModeId,
          payload,
        );

        /* 2 — parse backend result */
        const raw = await PARSERS[selectedMode.id as ReconModeId](blob);

        /* 3 — convert to GenericResult & persist in context
              ⚠ threeWay parser ALREADY gives an array of GenericResult   */
        const generic =
          selectedMode.id === 'threeWay'
            ? raw                              // GenericResult[]
            : toGeneric(selectedMode.id as ReconModeId, raw); // GenericResult

        setResult({
          genericResults: Array.isArray(generic) ? generic : [generic],
          downloadBlob: blob,
          downloadName: filename,
        });
        
        /* ---------------------------------------------
          STEP B  – build a PDF in-browser, turn to PNGs,
                    upload every PNG, store their URLs
        ---------------------------------------------- */
        let pdfBlob: Blob;

        // ❶ choose the correct generator
        switch (selectedMode.id as ReconModeId) {
          case 'twoWayInvoiceSummary':
            const blobPromise = captureNextPdfDownload();
            generateInvoiceSummaryReport(raw as InvoiceSummaryReportData);   // unchanged
            pdfBlob = await blobPromise;          // ← Blob in hand
            break;
          case 'twoWayProofSummary':
            const proofBlobPromise = captureNextPdfDownload();
            generateProofSummaryReport(raw as ProofSummaryReportData);
            pdfBlob = await proofBlobPromise;
            break;
          case 'twoWayPOGRN':
            const poGrnBlobPromise = captureNextPdfDownload();
            generatePOGrnReport(raw as POGrnReportData);
            pdfBlob = await poGrnBlobPromise;
            break;
          case 'threeWay': {
            /* ①   We still have `blob` coming from FastAPI – it is the ZIP. */
            const zip = await JSZip.loadAsync(blob);

            const invEntry = Object.values(zip.files)
              .find(f => /invoice.*reconciliation/i.test(f.name) && !f.dir);
            const chqEntry = Object.values(zip.files)
              .find(f => /cheque.*utilization/i.test(f.name)    && !f.dir);

            if (!invEntry || !chqEntry) throw new Error('ZIP missing XLSX files');

            /* ②   Extract each XLSX as File → feed existing parse…Excel */
            const [invBuf, chqBuf] = await Promise.all([
              invEntry.async('arraybuffer'),
              chqEntry.async('arraybuffer'),
            ]);

            const invFile = new File([invBuf], invEntry.name , { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const chqFile = new File([chqBuf], chqEntry.name , { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const [invoiceReport, chequeReport] = await Promise.all([
              parseThreeWayInvoiceExcel(invFile),        // returns ThreeWayInvoiceReportData
              parseChequeUtilizationExcel(chqFile),      // returns ChequeUtilizationReportData
            ]);

            /* ③   Generate TWO PDFs and capture each blob */
            const invPdfPromise = captureNextPdfDownload();
            generateThreeWayInvoiceReport(invoiceReport);
            const invoicePdf = await invPdfPromise;

            const chqPdfPromise = captureNextPdfDownload();
            generateChequeUtilizationReport(chequeReport);
            const chequePdf = await chqPdfPromise;

            /* ④   Merge -> ONE blob  */
            pdfBlob = await mergePdfBlobs([invoicePdf, chequePdf]);

            break;
          }
          default:
            throw new Error('Unsupported mode for PDF generation');
        }

        /* ❷ upload the single PDF – Cloudinary tells us how many pages it has */
        const cidBase      = `reconciliations/${runId ?? 'guest'}/${filename.replace(/\.(zip|xlsx)$/,'/report')}`;
        const { pdfUrl, pages, publicId } = await uploadPdfToCloudinary(pdfBlob, cidBase);

        /* ❸ derive HTTPS PNG links (no conversion client-side) */
        const pngUrls = buildPageUrls(publicId, pages);

        /* ❹ final Firestore patch */
        const firstStats = Array.isArray(generic) && generic.length
        ? (generic[0] as any).meta?.stats ?? null
        : null;

        const runLabel = Array.isArray(generic) && generic.length
          ? (generic[0] as any).meta?.modeLabel
          : null;

        await updateRun(user, runId, {
          status       : 'completed',
          markCompleted: true,
          ...(firstStats && { stats: firstStats }),
          ...(runLabel && { runLabel }),
          outputUrls   : { pdf: pdfUrl, pages: pngUrls },
        });

        /* 4 — push to results page (same route for all modes) */
        router.replace(
          `/result?filename=${encodeURIComponent(filename)}&runId=${runId ?? ''}`,
        );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        /* on error → patch Firestore & route */
        await updateRun(user, runId, {
          status       : 'error',
          errorMsg     : err?.message ?? 'Unknown error',
          markCompleted: true,
        });
        console.error(err);
        router.replace(
          `/result?status=error&msg=${encodeURIComponent(err?.message ?? 'Unknown error')}&runId=${runId ?? ''}`,
        );
      }
    })();
  }, [router, selectedMode, uploadedSources, setResult]);

  /* simple UI */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <LoadingSpinner size={64} />
      <p className="mt-8 text-center text-base text-gray-700 max-w-md px-4">
        {steps[idx]}
      </p>
    </div>
  );
}

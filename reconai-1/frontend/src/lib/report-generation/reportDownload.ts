/*  src/utils/reportDownload.ts  */
import JSZip from 'jszip';

/* ——— generators & parsers you already own ——— */
import {
  parseThreeWayInvoiceExcel,
  generateThreeWayInvoiceReport,
} from '@/lib/report-generation/generateThreeWayInvoiceReport';

import {
  parseChequeUtilizationExcel,
  generateChequeUtilizationReport,
} from '@/lib/report-generation/generateChequeUtilizationReport';

import {
  parseInvoiceSummaryExcel,
  generateInvoiceSummaryReport,
} from '@/lib/report-generation/generateInvoiceSummaryReport';

import {
  parseProofSummaryExcel,
  generateProofSummaryReport,
} from '@/lib/report-generation/generateProofSummaryReport';

import {
  parsePOGrnExcel,
  generatePOGrnReport,
} from '@/lib/report-generation/poGrnReport';

/* ------------------------------------------------------------------ */
/** Map the four UI labels → a handler that:
 *  • parses the backend blob                             
 *  • calls the right `generate…Report()` function(s) which
 *    automatically trigger a pdfMake download.                           */
export async function generateAndDownloadReport(
  modeLabel: string,
  backendBlob: Blob,
): Promise<void> {
  /* === 3-WAY MODE (ZIP containing two XLSX files) ==================== */
  if (modeLabel.startsWith('Invoice ↔ Proof ↔ Summary (Invoices Sheet)')) {
    const zip = await JSZip.loadAsync(backendBlob);

    /* locate the two sheets by filename fragment */
    const invEntry    = Object.values(zip.files).find(f =>
      /invoice_reconciliation/i.test(f.name),
    );
    const chequeEntry = Object.values(zip.files).find(f =>
      /cheque_util/i.test(f.name),
    );

    if (!invEntry || !chequeEntry)
      throw new Error('ZIP does not contain expected XLSX files');

    /* Invoice-level PDF */
    {
      const buf   = await invEntry.async('arraybuffer');
      const file  = new File([buf], invEntry.name);
      const data  = await parseThreeWayInvoiceExcel(file);
      generateThreeWayInvoiceReport(data);          // triggers download
    }

    /* Cheque-utilisation PDF */
    {
      const buf   = await chequeEntry.async('arraybuffer');
      const file  = new File([buf], chequeEntry.name);
      const data  = await parseChequeUtilizationExcel(file);
      generateChequeUtilizationReport(data);        // triggers download
    }

    return; // done (2 PDFs downloaded)
  }

  /* === 2-WAY MODES ==================================================== */
  const xlFile = new File([backendBlob], 'report.xlsx', {
    type: backendBlob.type,
  });

  if (modeLabel.startsWith('Two-Way Matching (Invoice–Summary)')) {
    const data = await parseInvoiceSummaryExcel(xlFile);
    generateInvoiceSummaryReport(data);             // one PDF
    return;
  }

  if (modeLabel.startsWith('Two-Way Matching (Proof–Summary)')) {
    const data = await parseProofSummaryExcel(xlFile);
    generateProofSummaryReport(data);               // one PDF
    return;
  }

  if (modeLabel.startsWith('Two-Way Matching (PO–GRN)')) {
    const data = await parsePOGrnExcel(xlFile);
    generatePOGrnReport(data);                      // one PDF
    return;
  }

  throw new Error(`Unhandled mode label: ${modeLabel}`);
}
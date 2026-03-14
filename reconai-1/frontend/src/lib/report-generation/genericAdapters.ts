/*  src/utils/adapters.ts  */
import type { ReconModeId }   from '@/utils/api/endpoints';
import type { GenericResult } from '@/types/genericResult';

/* one-table converters */
import { invoiceSummaryReportToGeneric }  from '@/lib/report-generation/generateInvoiceSummaryReport';
import { proofSummaryReportToGeneric }    from '@/lib/report-generation/generateProofSummaryReport';
import { poGrnReportToGeneric }           from '@/lib/report-generation/poGrnReport';

/* two converters for 3-way */
import { threeWayInvoiceReportToGeneric } from '@/lib/report-generation/generateThreeWayInvoiceReport';
import { chequeReportToGeneric }          from '@/lib/report-generation/generateChequeUtilizationReport';

import { InvoiceSummaryReportData, ProofSummaryReportData, POGrnReportData, ThreeWayInvoiceReportData, ChequeUtilizationReportData } from '@/types/reconciliation';


/**
 * Every adapter turns the raw, mode-specific  **parsed report**
 * into one **or more** GenericResult objects.  
 * – All 2-way modes → [result] (array length 1)  
 * – 3-Way mode     → [invoiceResult, chequeResult]
 */
export const ADAPTERS: Record<
  ReconModeId,
  (report: unknown) => GenericResult[]
> = {
  /* ──────────────────────────────────────── 2-WAY MODES ───── */
  twoWayInvoiceSummary: (rpt) =>
    [invoiceSummaryReportToGeneric(rpt as InvoiceSummaryReportData)],

  twoWayProofSummary:   (rpt) =>
    [proofSummaryReportToGeneric(rpt as ProofSummaryReportData)],

  twoWayPOGRN:          (rpt) =>
    [poGrnReportToGeneric(rpt as POGrnReportData)],

  /* ──────────────────────────────────────── 3-WAY MODE ────── */
  threeWay: (rpt) => {
    /** the 3-way ZIP parser should give us:
     *    { invoiceReport: <InvoiceSheet>, chequeReport: <ChequeSheet> }
     */
    const {
      invoiceReport,
      chequeReport,
    } = rpt as {
      invoiceReport: ThreeWayInvoiceReportData;
      chequeReport : ChequeUtilizationReportData;
    };

    return [
      threeWayInvoiceReportToGeneric(invoiceReport),
      chequeReportToGeneric(chequeReport),
    ];
  },
};

/* convenience — call in one line */
export const toGeneric = (mode: ReconModeId, rpt: unknown): GenericResult[] =>
  ADAPTERS[mode](rpt);

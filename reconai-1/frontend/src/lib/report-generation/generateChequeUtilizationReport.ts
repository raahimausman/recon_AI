// frontend/src/lib/report-generation/generateChequeUtilizationReport.ts
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { ChequeRecord, ChequeUtilizationReportData } from '@/types/reconciliation';
import { GenericResult } from '@/types/genericResult';


pdfMake.vfs = pdfFonts.vfs;


export async function parseChequeUtilizationExcel(file: File): Promise<ChequeUtilizationReportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = XLSX.utils.sheet_to_json<any>(sheet);

      const detailedCheques: ChequeRecord[] = json.map((row) => ({
        proof_id: row['proof_id'],
        amount_numeric: parseFloat(row['amount_numeric']),
        sum_linked_invoices: parseFloat(row['sum_linked_invoices']),
        amount_match: row['amount_match'] === true || row['amount_match'] === 'TRUE',
        status: row['status'],
      }));

      // Summaries
      const totalCheques = detailedCheques.length;
      const fullyApplied = detailedCheques.filter((c) => c.status === 'Fully Applied').length;
      const overUnderApplied = detailedCheques.filter((c) => c.status === 'Over/Under Applied').length;
      const unusedCheques = detailedCheques.filter((c) => c.status === 'Unused Cheque').length;

      const report: ChequeUtilizationReportData = {
        reportId: `RECON-${Date.now()}`,
        generatedOn: new Date().toLocaleString(),
        matchingMode: 'Three-Way Matching (Invoice–Proof–Summary)',
        totalCheques,
        fullyApplied,
        overUnderApplied,
        unusedCheques,
        detailedCheques,
      };

      resolve(report);
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}


export function chequeReportToGeneric(
  rpt: ChequeUtilizationReportData
): GenericResult {
  return {
    meta: {
      modeLabel  : rpt.matchingMode,
      generatedOn: rpt.generatedOn,
      stats      : {
        totalCheques     : rpt.totalCheques,
        fullyApplied     : rpt.fullyApplied,
        overUnderApplied : rpt.overUnderApplied,
        unusedCheques    : rpt.unusedCheques,
      },
    },
    rows: rpt.detailedCheques.map((c) => ({
      proof_id: c.proof_id,
      amount_numeric: c.amount_numeric,
      sum_linked_invoices: c.sum_linked_invoices,
      amount_match: c.amount_match,
      status: c.status,
    })), 
  };
}


export function generateChequeUtilizationReport(data: ChequeUtilizationReportData) {
  const {
    reportId,
    generatedOn,
    matchingMode,
    totalCheques,
    fullyApplied,
    overUnderApplied,
    unusedCheques,
    detailedCheques,
  } = data;

  // Boolean label
  const boolLabel = (value?: boolean) =>
    value === true ? 'Yes' : value === false ? 'No' : '—';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docDefinition: any = {
    content: [
      // Cover
      { text: 'ReconAI Cheque Utilization Report', style: 'header', margin: [0, 0, 0, 20] },
      { text: matchingMode, style: 'subheader', margin: [0, 0, 0, 20] },
      { text: `Generated on: ${generatedOn}`, margin: [0, 0, 0, 30] },
      { text: 'Prepared by ReconAI Engine v1.0', italics: true, margin: [0, 0, 0, 40] },

      // Metadata
      { text: 'Report Metadata', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Field', bold: true },
              { text: 'Value', bold: true }
            ],
            ['Report ID', reportId],
            ['Generated On', generatedOn],
            ['Matching Mode', matchingMode],
            ['Total Cheques', totalCheques.toString()],
            ['Fully Applied', fullyApplied.toString()],
            ['Over/Under Applied', overUnderApplied.toString()],
            ['Unused Cheques', unusedCheques.toString()],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#F0FFF0' : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },
      {
        text:
          'This report summarizes cheque utilization results from three-way reconciliation between invoices, proofs of payment, and summary records. Each cheque was analyzed for matching allocation against invoices, with status flags for full application, partial application, or no usage.',
        margin: [0, 0, 0, 20],
      },

      // Executive Summary
      { text: 'Executive Summary', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Metric', bold: true },
              { text: 'Count', bold: true }
            ],
            ['Total Cheques', totalCheques.toString()],
            ['Fully Applied', fullyApplied.toString()],
            ['Over/Under Applied', overUnderApplied.toString()],
            ['Unused Cheques', unusedCheques.toString()],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#F0FFF0' : null),
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },
      {
        text:
          `Out of ${totalCheques} cheques processed, ${fullyApplied} were fully applied with matching invoice totals. ` +
          `${overUnderApplied} cheques were over- or under-applied, and ${unusedCheques} remained unused. These discrepancies should be reviewed for accurate payment allocation.`,
        margin: [0, 0, 0, 20],
      },

      // Issues Breakdown
      { text: 'Issues Breakdown', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*'],
          body: [
            [
              { text: 'Status', bold: true },
              { text: 'Count', bold: true },
              { text: 'Description', bold: true }
            ],
            ['Fully Applied', fullyApplied.toString(), 'Cheque amount matches linked invoices.'],
            ['Over/Under Applied', overUnderApplied.toString(), 'Cheque amount does not match invoices exactly.'],
            ['Unused Cheque', unusedCheques.toString(), 'No invoices linked to this cheque.'],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#F0FFF0' : null),
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },
      {
        text:
          'Finance teams should review over/under applied and unused cheques to ensure all payments are correctly matched to their intended invoices.',
        margin: [0, 0, 0, 20],
      },

      // Detailed Cheque Table
      { text: 'Detailed Cheque Utilization Table', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*'],
          body: [
            [
              { text: 'Cheque ID', bold: true },
              { text: 'Cheque Amount', bold: true },
              { text: 'Sum of Linked Invoices', bold: true },
              { text: 'Amount Match', bold: true },
              { text: 'Status', bold: true },
            ],
            ...detailedCheques.map(item => [
              { text: item.proof_id, noWrap: true },
              `$${item.amount_numeric.toFixed(2)}`,
              `$${item.sum_linked_invoices.toFixed(2)}`,
              boolLabel(item.amount_match),
              { text: item.status, noWrap: false },
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#F0FFF0' : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },
      {
        text:
          'This table lists each cheque with its amount, sum of linked invoice totals, amount match flag, and final status classification.',
      },
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true,
        alignment: 'center',
      },
      subheader: {
        fontSize: 16,
        italics: true,
        alignment: 'center',
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 10],
      },
    },
    defaultStyle: {
      fontSize: 10,
    },
    pageMargins: [40, 60, 40, 60],
  };

    // Generate and download PDF
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    pdfMake.createPdf(docDefinition).download(`Cheque_Utilization_Report_${timestamp}.pdf`);
}
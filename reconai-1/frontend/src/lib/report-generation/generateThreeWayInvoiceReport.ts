// frontend/src/lib/report-generation/generateThreeWayInvoiceReport.ts
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { InvoiceRecord, ThreeWayInvoiceReportData } from '@/types/reconciliation';
import { GenericResult } from '@/types/genericResult';


pdfMake.vfs = pdfFonts.vfs;


export async function parseThreeWayInvoiceExcel(file: File): Promise<ThreeWayInvoiceReportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = XLSX.utils.sheet_to_json<any>(sheet);

      const detailedInvoices: InvoiceRecord[] = json.map((row) => ({
        invoice_id: row['invoice_id'],
        invoice_total: parseFloat(row['invoice_total']),
        matched_cheques: row['matched_cheques'] || '',
        sum_proof_amounts: parseFloat(row['sum_proof_amounts']),
        vendor_match: row['vendor_match'] === true || row['vendor_match'] === 'TRUE',
        amount_match: row['amount_match'] === true || row['amount_match'] === 'TRUE',
        issues: row['issues'] || '',
      }));

      // Build summary metrics
      const totalInvoices = detailedInvoices.length;
      const matchedInvoices = detailedInvoices.filter((i) => i.issues === 'Matched').length;
      const issuesDetected = totalInvoices - matchedInvoices;

      // Breakdown
      const breakdownCounts: Record<string, number> = {};
      detailedInvoices.forEach((i) => {
        if (i.issues !== 'Matched') {
          i.issues.split(';').forEach((issue) => {
            const trimmed = issue.trim();
            if (!breakdownCounts[trimmed]) breakdownCounts[trimmed] = 0;
            breakdownCounts[trimmed]++;
          });
        }
      });

      const issuesBreakdown = Object.entries(breakdownCounts).map(([type, count]) => ({
        type,
        count,
      }));

      const report: ThreeWayInvoiceReportData = {
        reportId: `RECON-${Date.now()}`,
        generatedOn: new Date().toLocaleString(),
        matchingMode: 'Three-Way Matching (Invoice–Proof–Summary)',
        totalInvoices,
        matchedInvoices,
        issuesDetected,
        issuesBreakdown,
        detailedInvoices,
      };

      resolve(report);
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}


export function threeWayInvoiceReportToGeneric(
  rpt: ThreeWayInvoiceReportData
): GenericResult {
  return {
    meta: {
      modeLabel: rpt.matchingMode,
      generatedOn: rpt.generatedOn,
      stats: {
        totalInvoices: rpt.totalInvoices,
        matchedInvoices: rpt.matchedInvoices,
        issuesDetected: rpt.issuesDetected,
      },
    },
    rows: rpt.detailedInvoices.map((i) => ({
      invoice_id: i.invoice_id,
      invoice_total: i.invoice_total,
      matched_cheques: i.matched_cheques,
      sum_proof_amounts: i.sum_proof_amounts,
      vendor_match: i.vendor_match,
      amount_match: i.amount_match,
      issues: i.issues,
    })),
  };
}


export function generateThreeWayInvoiceReport(data: ThreeWayInvoiceReportData) {
  const {
    reportId,
    generatedOn,
    matchingMode,
    totalInvoices,
    matchedInvoices,
    issuesDetected,
    issuesBreakdown,
    detailedInvoices,
  } = data;

  // Helper to format Yes/No
  const boolLabel = (value: boolean) => (value ? 'Yes' : 'No');

  // Determine issues section
  const hasIssues = issuesBreakdown && issuesBreakdown.length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docDefinition: any = {
    content: [
      // Cover Page
      { text: 'ReconAI Invoice Reconciliation Report', style: 'header', margin: [0, 0, 0, 20] },
      { text: matchingMode, style: 'subheader', margin: [0, 0, 0, 20] },
      { text: `Generated on: ${generatedOn}`, margin: [0, 0, 0, 30] },
      { text: 'Prepared by ReconAI Engine v1.0', italics: true, margin: [0, 0, 0, 40] },

      // Metadata Section
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
            ['Total Invoices', totalInvoices.toString()],
            ['Matched Invoices', matchedInvoices.toString()],
            ['Issues Detected', issuesDetected.toString()],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#E0F7FA' : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },
      {
        text:
          'This report summarizes three-way reconciliation between invoices, proofs of payment, and summary records. Amount and vendor consistency have been validated, with issues flagged for review.',
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
            ['Total Invoices', totalInvoices.toString()],
            ['Matched', matchedInvoices.toString()],
            ['Issues', issuesDetected.toString()],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#E0F7FA' : null),
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },
      {
        text:
          `Of ${totalInvoices} invoices processed, ${matchedInvoices} were fully matched. ` +
          `${issuesDetected} invoices had issues like amount mismatches, vendor mismatches, or missing proofs.`,
        margin: [0, 0, 0, 20],
      },

      // Issues Breakdown
      { text: 'Issues Breakdown', style: 'sectionHeader' },
      hasIssues
        ? {
            table: {
              headerRows: 1,
              widths: ['*', '*', '*'],
              body: [
                [
                  { text: 'Issue Type', bold: true },
                  { text: 'Count', bold: true },
                  { text: 'Description', bold: true }
                ],
                ...issuesBreakdown.map(item => [
                  item.type,
                  item.count.toString(),
                  item.type === 'Amount Mismatch'
                    ? 'Proof allocations did not match invoice totals.'
                    : item.type === 'Vendor Mismatch'
                    ? 'Vendor names differed between invoice and proof.'
                    : 'No proof found for invoice.',
                ]),
              ],
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? '#E0F7FA' : null),
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 20],
          }
        : {
            text: 'No issues were detected in this reconciliation.',
            italics: true,
            margin: [0, 0, 0, 20],
          },

      hasIssues
        ? {
            text:
              'These issues should be reviewed. Amount mismatches may indicate entry errors or incorrect allocations. Vendor mismatches suggest naming inconsistencies. Missing proofs highlight gaps in payment documentation.',
            margin: [0, 0, 0, 20],
          }
        : {},

      // Detailed Table
      { text: 'Detailed Invoice Reconciliation Table', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*', '*', '*'],
          body: [
            [
              { text: 'Invoice ID', bold: true },
              { text: 'Invoice Total', bold: true },
              { text: 'Matched Cheques', bold: true },
              { text: 'Sum Proof Amounts', bold: true },
              { text: 'Vendor Match', bold: true },
              { text: 'Amount Match', bold: true },
              { text: 'Issues', bold: true },
            ],
            ...detailedInvoices.map(item => [
              { text: item.invoice_id, noWrap: true },
              `$${item.invoice_total.toFixed(2)}`,
              { text: item.matched_cheques || '-', noWrap: false },
              `$${item.sum_proof_amounts.toFixed(2)}`,
              boolLabel(item.vendor_match),
              boolLabel(item.amount_match),
              { text: item.issues, noWrap: false },
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#E0F7FA' : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },

      {
        text:
          'This table details each invoice, including cheques matched, proof sum totals, vendor and amount validation flags, and identified issues. Invoices flagged with issues should be reviewed to ensure accurate reconciliation.',
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
pdfMake.createPdf(docDefinition).download(`Invoice_Reconciliation_Report_${timestamp}.pdf`);
}
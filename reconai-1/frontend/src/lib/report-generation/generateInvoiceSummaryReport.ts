// frontend/src/lib/report-generation/generateInvoiceSummaryReport.ts
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { InvoiceSummaryReportData, InvoiceSummaryRecord } from '@/types/reconciliation';
import { GenericResult } from '@/types/genericResult';


pdfMake.vfs = pdfFonts.vfs;


export async function parseInvoiceSummaryExcel(file: File): Promise<InvoiceSummaryReportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = XLSX.utils.sheet_to_json<any>(sheet);

      // Filter only uploaded invoices
      const uploaded = json.filter(
        row => row['uploaded_invoice'] === true || row['uploaded_invoice'] === 'TRUE'
      );

      // Split into Missing in Summary and Reconciliation
      const missingSummaryInvoices: InvoiceSummaryRecord[] = [];
      const reconciliationInvoices: InvoiceSummaryRecord[] = [];

      uploaded.forEach(row => {
        const issuesRaw = String(row['issues'] ?? '').trim();
        const record: InvoiceSummaryRecord = {
          invoice_id: String(row['invoice_id'] ?? '-'),
          vendor_name_inv: String(row['vendor_name_inv'] ?? '-'),
          vendor_name_sum: String(row['vendor_name_sum'] ?? '-'),
          total_amount_inv: isNaN(Number(row['total_amount_inv'])) ? 0 : Number(row['total_amount_inv']),
          total_amount_sum: isNaN(Number(row['total_amount_sum'])) ? 0 : Number(row['total_amount_sum']),
          issues: issuesRaw || '-',
        };

        if (issuesRaw === 'Missing in Summary') {
          missingSummaryInvoices.push(record);
        } else {
          reconciliationInvoices.push(record);
        }
      });

      // Count stats
      const totalInvoices = uploaded.length;
      const matchedInvoices = reconciliationInvoices.filter(i => i.issues === 'Matched').length;
      const missingInSummaryInvoices = missingSummaryInvoices.length;
      const issuesDetected = totalInvoices - matchedInvoices - missingInSummaryInvoices;

      // Issues Breakdown (excluding Missing in Summary)
      const breakdownCounts: Record<string, number> = {};
      reconciliationInvoices.forEach(i => {
        if (i.issues && i.issues !== 'Matched') {
          i.issues.split(';').forEach(issue => {
            const trimmed = issue.trim();
            if (trimmed) {
              if (!breakdownCounts[trimmed]) breakdownCounts[trimmed] = 0;
              breakdownCounts[trimmed]++;
            }
          });
        }
      });

      const issuesBreakdown = Object.entries(breakdownCounts).map(([type, count]) => ({
        type,
        count,
      }));

      const report: InvoiceSummaryReportData = {
        reportId: `RECON-${Date.now()}`,
        generatedOn: new Date().toLocaleString(),
        matchingMode: 'Two-Way Matching (Invoice–Summary)',
        totalInvoices,
        matchedInvoices,
        issuesDetected,
        missingInSummaryInvoices,
        issuesBreakdown,
        reconciliationInvoices,
        missingSummaryInvoices,
      };

      resolve(report);
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}


export function invoiceSummaryReportToGeneric(
  rpt: InvoiceSummaryReportData
): GenericResult {
  return {
    meta: {
      modeLabel: rpt.matchingMode,
      generatedOn: rpt.generatedOn,
      stats: {
        totalInvoices: rpt.totalInvoices,
        matchedInvoices: rpt.matchedInvoices,
        missingInSummaryInvoices: rpt.missingInSummaryInvoices,
        issuesDetected: rpt.issuesDetected,
      },
    },
    rows: [
      ...rpt.reconciliationInvoices.map((i) => ({
        invoice_id: i.invoice_id,
        vendor_name_inv: i.vendor_name_inv,
        vendor_name_sum: i.vendor_name_sum,
        total_amount_inv: i.total_amount_inv,
        total_amount_sum: i.total_amount_sum,
        issues: i.issues,
      })),
      ...rpt.missingSummaryInvoices.map((i) => ({
        invoice_id: i.invoice_id,
        vendor_name_inv: i.vendor_name_inv,
        vendor_name_sum: '-', // Not available for missing in summary
        total_amount_inv: i.total_amount_inv,
        total_amount_sum: 0, // Not available for missing in summary
        issues: i.issues,
      })),
    ],
  };
}


export function generateInvoiceSummaryReport(data: InvoiceSummaryReportData) {
  const {
    reportId,
    generatedOn,
    matchingMode,
    totalInvoices,
    matchedInvoices,
    issuesDetected,
    missingInSummaryInvoices,
    issuesBreakdown,
    reconciliationInvoices,
  } = data;

  const hasIssues = issuesBreakdown && issuesBreakdown.length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docDefinition: any = {
    content: [
      // Cover Page
      { text: 'ReconAI Invoice–Summary Reconciliation Report', style: 'header', margin: [0, 0, 0, 20] },
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
            [{ text: 'Field', bold: true }, { text: 'Value', bold: true }],
            ['Report ID', reportId],
            ['Generated On', generatedOn],
            ['Matching Mode', matchingMode],
            ['Total Uploaded Invoices', totalInvoices.toString()],
            ['Matched Invoices', matchedInvoices.toString()],
            ['Missing in Summary Invoices', missingInSummaryInvoices.toString()],
            ['Other Issues Detected', issuesDetected.toString()],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#EDE0F5' : null),
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },

      // Executive Summary
      { text: 'Executive Summary', style: 'sectionHeader' },
      {
        text: `Of ${totalInvoices} uploaded invoices, ${matchedInvoices} were fully matched with summary records. ${missingInSummaryInvoices} invoices were missing in summary entirely. ${issuesDetected} invoices had vendor or amount mismatches that require review.`,
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
                [{ text: 'Issue Type', bold: true }, { text: 'Count', bold: true }, { text: 'Description', bold: true }],
                ...issuesBreakdown.map(item => [
                  item.type,
                  item.count.toString(),
                  item.type === 'Amount'
                    ? 'Invoice amount did not match summary.'
                    : 'Vendor names did not match summary records.',
                ]),
              ],
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? '#EDE0F5' : null),
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 20],
          }
        : {
            text: 'No issues (vendor or amount mismatches) were detected in matched invoices.',
            italics: true,
            margin: [0, 0, 0, 20],
          },

      // Reconciliation Results Table
      { text: 'Reconciliation Results', style: 'sectionHeader' },
      reconciliationInvoices.length > 0
        ? {
            table: {
              headerRows: 1,
              widths: ['*', '*', '*', '*', '*', '*'],
              body: [
                [
                  { text: 'Invoice ID', bold: true },
                  { text: 'Vendor (Invoice)', bold: true },
                  { text: 'Vendor (Summary)', bold: true },
                  { text: 'Amount (Invoice)', bold: true },
                  { text: 'Amount (Summary)', bold: true },
                  { text: 'Issues', bold: true },
                ],
                ...reconciliationInvoices.map(item => [
                  item.invoice_id ?? '-',
                  item.vendor_name_inv ?? '-',
                  item.vendor_name_sum ?? '-',
                  `$${item.total_amount_inv?.toFixed(2) ?? '0.00'}`,
                  `$${item.total_amount_sum?.toFixed(2) ?? '0.00'}`,
                  item.issues ?? '-',
                ]),
              ],
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? '#EDE0F5' : null),
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 20],
          }
        : {
            text: 'No reconciliation results to display.',
            italics: true,
            margin: [0, 0, 0, 20],
          },

      // Missing In Summary Table
      { text: 'Invoices Missing in Summary', style: 'sectionHeader' },
      data.missingSummaryInvoices.length > 0
        ? {
            table: {
              headerRows: 1,
              widths: ['*', '*', '*'],
              body: [
                [
                  { text: 'Invoice ID', bold: true },
                  { text: 'Vendor (Invoice)', bold: true },
                  { text: 'Amount (Invoice)', bold: true },
                ],
                ...data.missingSummaryInvoices.map(item => [
                  item.invoice_id ?? '-',
                  item.vendor_name_inv ?? '-',
                  `$${item.total_amount_inv?.toFixed(2) ?? '0.00'}`,
                ]),
              ],
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? '#EDE0F5' : null),
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 20],
          }
        : {
            text: 'No invoices were missing in summary.',
            italics: true,
            margin: [0, 0, 0, 20],
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
    pdfMake.createPdf(docDefinition).download(`Invoice_Summary_Reconciliation_Report_${timestamp}.pdf`);
}
// frontend/src/lib/report-generation/generateProofSummaryReport.ts
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { ProofSummaryReportData, ProofSummaryRecord, ProofSummaryMissingRecord } from '@/types/reconciliation';
import { GenericResult } from '@/types/genericResult';


pdfMake.vfs = pdfFonts.vfs;


export async function parseProofSummaryExcel(file: File): Promise<ProofSummaryReportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = XLSX.utils.sheet_to_json<any>(sheet);

      const totalProofs = json.length;

      // Split into uploaded vs missing in upload
      const uploadedProofs = json.filter(
        row => String(row['issues']).trim() !== 'Missing Proof'
      );

      const missingProofs: ProofSummaryMissingRecord[] = json
        .filter(row => String(row['issues']).trim() === 'Missing Proof')
        .map(row => ({
          proof_id: String(row['proof_id'] ?? '-'),
          party_name: String(row['party_name'] ?? '-'),
          amount_numeric: isNaN(row['amount_numeric']) ? 0 : parseFloat(row['amount_numeric']),
        }));

      const detailedProofs: ProofSummaryRecord[] = uploadedProofs.map(row => {
        const vendorMatch = row['vendor_match'] === true || row['vendor_match'] === 'TRUE';
        const amountMatch = row['amount_match'] === true || row['amount_match'] === 'TRUE';

        let issues = String(row['issues'] ?? '').trim();
        if (!issues) {
          issues = '-';
        }

        return {
          proof_id: String(row['proof_id'] ?? '-'),
          party_name: String(row['party_name'] ?? '-'),
          amount_numeric: isNaN(Number(row['amount_numeric'])) ? 0 : Number(row['amount_numeric']),
          sum_invoice_total: isNaN(Number(row['sum_invoice_total'])) ? 0 : Number(row['sum_invoice_total']),
          vendor_match: vendorMatch,
          amount_match: amountMatch,
          issues,
        };
      });

      const uploadedCount = uploadedProofs.length;
      const missingCount = missingProofs.length;
      const matchedProofs = detailedProofs.filter(p => p.issues === 'Matched').length;
      const issuesDetected = uploadedCount - matchedProofs;

      // Issues Breakdown
      const breakdownCounts: Record<string, number> = {};
      detailedProofs.forEach(p => {
        if (p.issues && p.issues !== 'Matched') {
          p.issues.split(';').forEach(issue => {
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

      const report: ProofSummaryReportData = {
        reportId: `RECON-${Date.now()}`,
        generatedOn: new Date().toLocaleString(),
        matchingMode: 'Two-Way Matching (Proof–Summary)',
        totalProofs,
        uploadedProofs: uploadedCount,
        missingInUploadProofs: missingCount,
        matchedProofs,
        issuesDetected,
        issuesBreakdown,
        detailedProofs,
        missingProofs,
      };

      resolve(report);
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}


export function proofSummaryReportToGeneric(
  rpt: ProofSummaryReportData
): GenericResult {
  return {
    meta: {
      modeLabel: rpt.matchingMode,
      generatedOn: rpt.generatedOn,
      stats: {
        totalProofs: rpt.totalProofs,
        uploadedProofs: rpt.uploadedProofs,
        missingInUploadProofs: rpt.missingInUploadProofs,
        matchedProofs: rpt.matchedProofs,
        issuesDetected: rpt.issuesDetected,
      },
    },
    rows: rpt.detailedProofs.map((p) => ({
      proof_id: p.proof_id,
      party_name: p.party_name,
      amount_numeric: p.amount_numeric,
      sum_invoice_total: p.sum_invoice_total,
      vendor_match: p.vendor_match,
      amount_match: p.amount_match,
      issues: p.issues,
    })),
  };
}


export function generateProofSummaryReport(data: ProofSummaryReportData) {
  const {
    reportId,
    generatedOn,
    matchingMode,
    totalProofs,
    uploadedProofs,
    missingInUploadProofs,
    matchedProofs,
    issuesDetected,
    issuesBreakdown,
    detailedProofs,
  } = data;

  const hasIssues = issuesBreakdown && issuesBreakdown.length > 0;

  const boolLabel = (value: boolean) => (value ? 'Yes' : 'No');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docDefinition: any = {
    content: [
      // Cover
      { text: 'ReconAI Proof–Summary Reconciliation Report', style: 'header', margin: [0, 0, 0, 20] },
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
            ['Total Proofs in Summary', totalProofs.toString()],
            ['Uploaded Proofs', uploadedProofs.toString()],
            ['Proofs Missing in Upload', missingInUploadProofs.toString()],
            ['Matched Proofs', matchedProofs.toString()],
            ['Issues Detected', issuesDetected.toString()],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#FDE2E2' : null),
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },

      // Executive Summary
      { text: 'Executive Summary', style: 'sectionHeader' },
      {
        text: `Of ${totalProofs} proofs in summary, ${uploadedProofs} were uploaded by the user and analyzed in this report. ${matchedProofs} matched summary records. ${missingInUploadProofs} proofs were missing in the upload and should be provided for future reconciliations. ${issuesDetected} proofs had vendor or amount mismatches that require review.`,
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
                    ? 'Payment amount did not match summary.'
                    : 'Party name did not match summary records.',
                ]),
              ],
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? '#FDE2E2' : null),
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 20],
          }
        : {
            text: 'No issues (vendor or amount mismatches) were detected in matched proofs.',
            italics: true,
            margin: [0, 0, 0, 20],
          },

      // Detailed Uploaded Proofs Table
      { text: 'Detailed Proof–Summary Reconciliation Table', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*', '*', '*'],
          body: [
            [
              { text: 'Proof ID', bold: true },
              { text: 'Party Name', bold: true },
              { text: 'Amount', bold: true },
              { text: 'Sum of Invoices', bold: true },
              { text: 'Vendor Match', bold: true },
              { text: 'Amount Match', bold: true },
              { text: 'Issues', bold: true },
            ],
            ...detailedProofs.map(item => [
              item.proof_id ?? '-',
              item.party_name ?? '-',
              `$${item.amount_numeric?.toFixed(2) ?? '0.00'}`,
              `$${item.sum_invoice_total?.toFixed(2) ?? '0.00'}`,
              boolLabel(item.vendor_match),
              boolLabel(item.amount_match),
              item.issues ?? '-',
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#FDE2E2' : null),
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },
      {
        text: 'This table lists each uploaded proof of payment with its summary comparison, vendor and amount match flags, and detected issues.',
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

  // Generate PDF and download
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  pdfMake.createPdf(docDefinition).download(`Proof_Summary_Reconciliation_Report_${timestamp}.pdf`);
}

// frontend/src/lib/report-generation/poGrnReport.ts
import * as XLSX   from 'xlsx';
import pdfMake     from 'pdfmake/build/pdfmake';
import pdfFonts    from 'pdfmake/build/vfs_fonts';
import { POGrnRecord, POGrnReportData } from '@/types/reconciliation';
import { GenericResult } from '@/types/genericResult';


pdfMake.vfs = pdfFonts.vfs;


export async function parsePOGrnExcel(file: File): Promise<POGrnReportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const wb  = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = XLSX.utils.sheet_to_json<any>(ws);

      /* split rows */
      const missingRows: POGrnRecord[] = [];
      const reconRows:   POGrnRecord[] = [];

      raw.forEach(r => {
        const rec: POGrnRecord = {
          po_number:       String(r['po_number']       ?? '-'),
          vendor_name_po:  String(r['vendor_name']  ?? '-'),
          total_amount_po: Number(r['total_amount']) || 0,
          status:          String(r['status'] ?? '-').trim(),
        };

        if (rec.status === 'Missing GRN')    missingRows.push(rec);
        else                                  reconRows.push(rec);
      });

      /* counts */
      const totalPOs     = raw.length;
      const matchedPOs   = reconRows.filter(r => r.status === 'Fully Matched' || r.status === 'Matched').length;
      const missingGRN   = missingRows.length;
      const issuesDetected = totalPOs - matchedPOs - missingGRN;

      /* breakdown (exclude Missing GRN, Fully Matched) */
      const counts: Record<string, number> = {};
      reconRows.forEach(r => {
        if (r.status && r.status !== 'Fully Matched' && r.status !== 'Matched') {
          r.status.split(';').forEach(s => {
            const key = s.trim();
            if (key) counts[key] = (counts[key] || 0) + 1;
          });
        }
      });
      const issuesBreakdown = Object.entries(counts).map(([type, count]) => ({ type, count }));

      resolve({
        reportId:    `POGRN-${Date.now()}`,
        generatedOn: new Date().toLocaleString(),
        matchingMode: 'Two-Way Matching (PO–GRN)',
        totalPOs,
        matchedPOs,
        missingGRN,
        issuesDetected,
        issuesBreakdown,
        reconciliationRows: reconRows,
        missingGrnRows:     missingRows,
      });
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}


export function poGrnReportToGeneric(
  rpt: POGrnReportData
): GenericResult {
  return {
    meta: {
      modeLabel  : rpt.matchingMode,
      generatedOn: rpt.generatedOn,
      stats      : {
        totalPOs       : rpt.totalPOs,
        matchedPOs     : rpt.matchedPOs,
        missingGRN     : rpt.missingGRN,
        issuesDetected : rpt.issuesDetected,
      },
    },
    rows: rpt.reconciliationRows.map((r) => ({
      po_number:       r.po_number,
      vendor_name_po:  r.vendor_name_po,
      total_amount_po: r.total_amount_po,
      status:          r.status,
    })),
  };
}


export function generatePOGrnReport(data: POGrnReportData) {
  const {
    reportId,
    generatedOn,
    matchingMode,
    totalPOs,
    matchedPOs,
    missingGRN,
    issuesDetected,
    issuesBreakdown,
    reconciliationRows,
    missingGrnRows,
  } = data;

  const hasIssues = issuesBreakdown.length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docDefinition: any = {
    pageMargins: [40, 60, 40, 60],
    defaultStyle: { fontSize: 10 },

    styles: {
      header:        { fontSize: 22, bold: true, alignment: 'center' },
      subheader:     { fontSize: 16, italics: true, alignment: 'center' },
      sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 10] },
    },

    content: [
      /* ─ cover ─ */
      { text: 'ReconAI PO–GRN Reconciliation Report', style: 'header', margin: [0, 0, 0, 20] },
      { text: matchingMode, style: 'subheader', margin: [0, 0, 0, 20] },
      { text: `Generated on: ${generatedOn}`, margin: [0, 0, 0, 30] },
      { text: 'Prepared by ReconAI Engine v1.0', italics: true, margin: [0, 0, 0, 40] },

      /* ─ meta table ─ */
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
            ['Total POs', totalPOs.toString()],
            ['Matched POs', matchedPOs.toString()],
            ['POs Missing GRN', missingGRN.toString()],
            ['Other Issues Detected', issuesDetected.toString()],
          ],
        },
        layout: {
          fillColor: (r: number) => (r === 0 ? '#EDE0F5' : null),
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },

      /* ─ summary text ─ */
      { text: 'Executive Summary', style: 'sectionHeader' },
      {
        text:
          `Out of ${totalPOs} purchase orders processed, ${matchedPOs} were fully matched with GRNs. ` +
          `${missingGRN} POs had no corresponding GRN. ` +
          `${issuesDetected} POs showed vendor or amount mismatches that require follow-up.`,
        margin: [0, 0, 0, 20],
      },

      /* ─ breakdown ─ */
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
                  { text: 'Description', bold: true },
                ],
                ...issuesBreakdown.map(({ type, count }) => [
                  type,
                  count.toString(),
                  type === 'Amount Mismatch'
                    ? 'PO amount differs from GRN.'
                    : 'Vendor names differ between PO and GRN.',
                ]),
              ],
            },
            layout: {
              fillColor: (r: number) => (r === 0 ? '#EDE0F5' : null),
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 20],
          }
        : {
            text: 'No vendor / amount mismatches detected.',
            italics: true,
            margin: [0, 0, 0, 20],
          },

      /* ─ reconciliation table ─ */
      { text: 'Reconciliation Results', style: 'sectionHeader' },
      reconciliationRows.length
        ? {
            table: {
              headerRows: 1,
              widths: ['*', '*', '*', '*'],
              body: [
                [
                  { text: 'PO Number', bold: true },
                  { text: 'Vendor', bold: true },
                  { text: 'Amount (PO)', bold: true },
                  { text: 'Status', bold: true },
                ],
                ...reconciliationRows.map(r => [
                  r.po_number,
                  r.vendor_name_po,
                  `$${r.total_amount_po.toFixed(2)}`,
                  r.status,
                ]),
              ],
            },
            layout: {
              fillColor: (r: number) => (r === 0 ? '#EDE0F5' : null),
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 20],
          }
        : { text: 'No reconciliation rows to display.', italics: true, margin: [0, 0, 0, 20] },

      /* ─ missing GRN table ─ */
      { text: 'POs Missing GRN', style: 'sectionHeader' },
      missingGrnRows.length
        ? {
            table: {
              headerRows: 1,
              widths: ['*', '*', '*'],
              body: [
                [
                  { text: 'PO Number', bold: true },
                  { text: 'Vendor', bold: true },
                  { text: 'Amount (PO)', bold: true },
                ],
                ...missingGrnRows.map(r => [
                  r.po_number,
                  r.vendor_name_po,
                  `$${r.total_amount_po.toFixed(2)}`,
                ]),
              ],
            },
            layout: {
              fillColor: (r: number) => (r === 0 ? '#EDE0F5' : null),
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
          }
        : { text: 'No POs were missing GRN.', italics: true },
    ],
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  pdfMake.createPdf(docDefinition).download(`PO_GRN_Reconciliation_Report_${ts}.pdf`);
}
// src/lib/report-generation/parseThreeWayZip.ts
'use client';

import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { GenericResult, Cell } from '@/types/genericResult';

/* --------------------------------------------------------- *
 * utility: XLSX (ArrayBuffer) -> JSON rows                  *
 * --------------------------------------------------------- */
async function sheetToJson(buf: ArrayBuffer): Promise<Record<string, Cell>[]> {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]]; // first – and only – sheet
  // eslint-disable-next-line @typescript-eslint/no-explic it-any
  return XLSX.utils.sheet_to_json<any>(ws);
}

/* --------------------------------------------------------- *
 * main export                                               *
 * --------------------------------------------------------- */
export async function parseThreeWayZip(
  zipBlob: Blob,
): Promise<GenericResult[]> {
  const zip = await JSZip.loadAsync(zipBlob);

  /* ── locate files inside the archive ─────────────────── */
  const invoiceEntry = Object.values(zip.files).find(
    (f) => /invoice.*reconciliation/i.test(f.name) && !f.dir,
  );
  const chequeEntry = Object.values(zip.files).find(
    (f) => /cheque.*utilization/i.test(f.name) && !f.dir,
  );

  if (!invoiceEntry || !chequeEntry) {
    throw new Error(
      'ZIP is missing one of the expected XLSX files (invoice reconciliation / cheque utilization).',
    );
  }

  /* ── read both sheets in parallel ────────────────────── */
  const [invBuf, chequeBuf] = await Promise.all([
    invoiceEntry.async('arraybuffer'),
    chequeEntry.async('arraybuffer'),
  ]);

  const [invoiceRows, chequeRows] = await Promise.all([
    sheetToJson(invBuf),
    sheetToJson(chequeBuf),
  ]);

  /* ── build GenericResult for invoices ────────────────── */
  const invTotal = invoiceRows.length;
  const invMatched = invoiceRows.filter((r) => r.issues === 'Matched').length;

  const invoiceResult: GenericResult = {
    meta: {
      modeLabel: 'Invoice ↔ Proof ↔ Summary (Invoices Sheet)',
      generatedOn: new Date().toLocaleString(),
      stats: {
        total: invTotal,
        matched: invMatched,
        issues: invTotal - invMatched,
      },
    },
    rows: invoiceRows,
  };

  /* ── build GenericResult for cheques ─────────────────── */
  const chkTotal = chequeRows.length;
  const chkUnused = chequeRows.filter(
    (r) => String(r.status).trim() === 'Unused Cheque',
  ).length;

  const chequeResult: GenericResult = {
    meta: {
      modeLabel: 'Invoice ↔ Proof ↔ Summary (Cheques Sheet)',
      generatedOn: new Date().toLocaleString(),
      stats: {
        total: chkTotal,
        unused: chkUnused,
        applied: chkTotal - chkUnused,
      },
    },
    rows: chequeRows,
  };

  return [invoiceResult, chequeResult];
}

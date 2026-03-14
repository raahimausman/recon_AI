import type { SourceType } from '@/types/source';

/* ──────────────────
   Match the IDs you already use in RECONCILIATION_MODES
   ────────────────── */
export type ReconModeId =
  | 'threeWay'                 // Invoice-Proof-Summary (3-way)
  | 'twoWayInvoiceSummary'     // Invoice ↔ Summary
  | 'twoWayProofSummary'       // Proof  ↔ Summary
  | 'twoWayPOGRN';             // PO     ↔ GRN

export interface ReconEndpointMeta {
  url: string;                                             // FastAPI path
  requiredSources: SourceType[];                           // wizard slots
  fieldMap: Partial<Record<SourceType, string>>;           // only those used
  responseExt: 'xlsx' | 'zip';                             // expected payload
}

export const RECON_ENDPOINTS: Record<ReconModeId, ReconEndpointMeta> = {
  threeWay: {
    url: '/inv-proof-sum',
    requiredSources: ['Invoice', 'Proof of Payment', 'Summary of Invoices'],
    fieldMap: {
      Invoice: 'invoice_files',
      'Proof of Payment': 'proof_files',
      'Summary of Invoices': 'summary_file',
    },
    responseExt: 'zip',
  },

  twoWayInvoiceSummary: {
    url: '/inv-sum',
    requiredSources: ['Invoice', 'Summary of Invoices'],
    fieldMap: {
      Invoice: 'invoice_files',
      'Summary of Invoices': 'summary_file',
    },
    responseExt: 'xlsx',
  },

  twoWayProofSummary: {
    url: '/proof-sum',
    requiredSources: ['Proof of Payment', 'Summary of Invoices'],
    fieldMap: {
      'Proof of Payment': 'proof_files',
      'Summary of Invoices': 'summary_file',
    },
    responseExt: 'xlsx',
  },

  twoWayPOGRN: {
    url: '/po-grn',
    requiredSources: ['Purchase Order', 'Goods Receipt Note'],
    fieldMap: {
      'Purchase Order': 'po_files',
      'Goods Receipt Note': 'grn_files',
    },
    responseExt: 'xlsx',
  },
};

import { SourceType } from './source';

export interface ReconciliationMode {
  id: string;
  label: string;
  description: string;
  expectedSources: SourceType[];
}

export const RECONCILIATION_MODES: ReconciliationMode[] = [
  {
    id: 'threeWay',
    label: 'Three-way Matching: Invoice, Proof, Summary',
    description: 'Match invoices to payment proofs and validate against summary records.',
    expectedSources: ['Invoice', 'Proof of Payment', 'Summary of Invoices'],
  },
  {
    id: 'twoWayInvoiceSummary',
    label: 'Two-way Matching: Invoice ↔ Summary',
    description: 'Reconcile invoices directly with summary records.',
    expectedSources: ['Invoice', 'Summary of Invoices'],
  },
  {
    id: 'twoWayProofSummary',
    label: 'Two-way Matching: Proof ↔ Summary',
    description: 'Verify payment proofs align with summary records.',
    expectedSources: ['Proof of Payment', 'Summary of Invoices'],
  },
  {
    id: 'twoWayPOGRN',
    label: 'Two-way Matching: Purchase Order ↔ GRN',
    description: 'Ensure purchase orders match received goods notes accurately.',
    expectedSources: ['Purchase Order', 'Goods Receipt Note'],
  },
];

export interface InvoiceRecord {
  invoice_id: string;
  invoice_total: number;
  matched_cheques: string;
  sum_proof_amounts: number;
  vendor_match: boolean;
  amount_match: boolean;
  issues: string;
}

export interface IssuesBreakdownItem {
  type: string;
  count: number;
}

export interface ThreeWayInvoiceReportData {
  reportId: string;
  generatedOn: string;
  matchingMode: string;
  totalInvoices: number;
  matchedInvoices: number;
  issuesDetected: number;
  issuesBreakdown: IssuesBreakdownItem[];
  detailedInvoices: InvoiceRecord[];
}

export interface ChequeRecord {
  proof_id: string;
  amount_numeric: number;
  sum_linked_invoices: number;
  amount_match: boolean;
  status: string;
}

export interface ChequeUtilizationReportData {
  reportId: string;
  generatedOn: string;
  matchingMode: string;
  totalCheques: number;
  fullyApplied: number;
  overUnderApplied: number;
  unusedCheques: number;
  detailedCheques: ChequeRecord[];
}

export interface InvoiceSummaryRecord {
  invoice_id: string;
  vendor_name_inv: string;
  vendor_name_sum: string;
  total_amount_inv: number;
  total_amount_sum: number;
  issues: string;
}

export interface InvoiceSummaryReportData {
  reportId: string;
  generatedOn: string;
  matchingMode: string;
  totalInvoices: number;
  matchedInvoices: number;
  issuesDetected: number;
  missingInSummaryInvoices: number;
  issuesBreakdown: { type: string; count: number }[];
  reconciliationInvoices: InvoiceSummaryRecord[];
  missingSummaryInvoices: InvoiceSummaryRecord[];
}

export interface ProofSummaryRecord {
  proof_id: string;
  party_name: string;
  amount_numeric: number;
  sum_invoice_total: number;
  vendor_match: boolean;
  amount_match: boolean;
  issues: string;
}

export interface ProofSummaryMissingRecord {
  proof_id: string;
  party_name: string;
  amount_numeric: number;
}

export interface ProofSummaryReportData {
  reportId: string;
  generatedOn: string;
  matchingMode: string;
  totalProofs: number;
  uploadedProofs: number;
  missingInUploadProofs: number;
  matchedProofs: number;
  issuesDetected: number;
  issuesBreakdown: { type: string; count: number }[];
  detailedProofs: ProofSummaryRecord[];
  missingProofs: ProofSummaryMissingRecord[];
}

export interface POGrnRecord {
  po_number:       string;
  vendor_name_po:  string;
  total_amount_po: number;
  status:          string;           
}

export interface POGrnReportData {
  reportId:   string;
  generatedOn: string;
  matchingMode: string;
  totalPOs:          number;
  matchedPOs:        number;
  missingGRN:        number;
  issuesDetected:    number;
  issuesBreakdown:  { type: string; count: number }[];
  reconciliationRows: POGrnRecord[];
  missingGrnRows:     POGrnRecord[];
}

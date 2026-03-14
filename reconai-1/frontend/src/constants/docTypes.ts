// Maps the UI “Source Type” to FastAPI expected_type keyword
export const DOC_TYPE_MAP: Record<string, string> = {
  Invoice: 'INVOICE',
  'Proof of Payment': 'PROOF_OF_PAYMENT',
  'Summary of Invoices': 'SUMMARY',
  'Purchase Order': 'PURCHASE_ORDER',
  'Goods Receipt Note': 'GRN',
};
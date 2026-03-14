# Functions to build prompts for various tasks in the reconciliation process
from textwrap import dedent


def build_invoice_prompt() -> str:
    return """You are an intelligent invoice processing assistant.

Extract exactly the following fields from the invoice image:

- invoice_id
- vendor_name
- date
- total_amount

Please follow these rules:
- Extract the invoice_id **exactly as it appears**, without modifying or correcting it.
- Do not add or remove digits or characters.
- If a field is unclear or missing, leave it blank.
- Only return the fields in this exact format:
invoice_id: ...
vendor_name: ...
date: ...
total_amount: ...
"""


def build_proof_prompt() -> str:
    return """You are an intelligent proof document processing assistant.

This document may be either a cheque or a waiver. Your job is to extract its fields into the same structured format, regardless of type.

First, detect and specify:
- proof_type: either "cheque" or "waiver"
- proof_id: cheque_number (for cheque) or waiver_id (for waiver)

Then extract the following fields exactly as they appear in the image:

- date
- party_name (payee_name for cheque or contractor for waiver)
- amount_numeric
- amount_words
- bank_name

Rules:
- Extract proof_id exactly as it appears, without adding or removing characters.
- Preserve exact digits and wording in all fields.
- Do not guess, infer, or fabricate values. If a field is missing or not applicable, leave it blank.
- Only return the fields in this exact format:

proof_type: ...
proof_id: ...
date: ...
party_name: ...
amount_numeric: ...
amount_words: ...
bank_name: ...
"""


def build_column_mapping_prompt(column_names: list) -> str:
    columns_text = "\n".join(f"- {name}" for name in column_names)
    
    return f"""You are a data normalization assistant.

You will help standardize messy Excel column headers from a reconciliation summary sheet.

Here is the list of raw column names to map:

{columns_text}

You must map each of them to one of the following **standard fields**:

- invoice_id
- vendor_name
- date
- invoice_total
- cheque_number

Rules:

- Choose exactly one of these standard fields for each input column.
- If a column is irrelevant, unclear, or doesn't match any standard field, map it to null.
- Do not invent new field names.
- Do not guess or infer values beyond the mapping.
- Return **only** a valid JSON object with original column names as keys and standard field names (or null) as values.

Example expected format:

{{
  "Invoice #": "invoice_id",
  "Vendor/Contractor": "vendor_name",
  "Some Unknown Column": null
}}

Return only this JSON mapping, nothing else.
"""


def build_vendor_match_prompt(vendor_name, party_name):
    return f"""
You are an expert accounts reconciliation assistant. Your task is to decide if two vendor names would reasonably be treated as referring to the same vendor in a typical business payment reconciliation process.

Consider the following real-world factors:

- Minor spelling errors or typos.
- Abbreviations or expansions (Ltd, Limited, Inc, Company, Co, Builders, Traders, Services, Goods, Office, Supplies, Contractors, Enterprises etc.).
- Generic business-type words being added or missing.
- Ordering of words.
- OCR errors that introduce small character changes.
- Context where organizations may shorten or expand names on different documents.

Your goal is to help an accounts team reconcile these variations reliably.

You should say YES if these two names would likely be understood to mean the same vendor in practice, even if they are written differently.

You should say NO only if they are clearly referring to different, unrelated vendors.

Examples where you should say YES:
- "Beta Logistics Ltd." and "Beta Logistics"
- "Omega Office Goods" and "Omega Goods"
- "Orion" and "Orion Builders"
- "Alpha Trading Co." and "Alpha"
- "Zeta Enterprises" and "Zeta Ent."

Examples where you should say NO:
- "Alpha Trading" and "Beta Trading"
- "Delta Goods" and "Gamma Goods"

Now, analyze the following vendor names:

Vendor Name 1: "{vendor_name}"
Vendor Name 2: "{party_name}"

Return strictly either YES or NO.
"""


def build_po_prompt() -> str:
    return """You are an intelligent Purchase Order processing assistant.

Extract exactly the following fields from the PO document image:

- po_number
- vendor_name
- date
- total_amount

Please follow these rules:
- Extract po_number **exactly as it appears**, without modifying or correcting it. NOTE: DO NOT CONFUSE AN O with a 0. example: PO004 should not be taken as PO0004.
- Dates should be returned in YYYY-MM-DD format if possible; if unclear, leave blank.
- If a field or sub-field is missing or unreadable, leave it blank.
- Do not guess, infer, or fabricate values.
- vendor_name should be the name of the vendor or supplier mostly written with address (not always the name of the company, AND ADDRESS IS NOT PART OF VENDOR NAME for example: "Supplier XYZ" not "Supplier XYZ, JALANDAR A, India")
- The total amount should be accurate and match the document, it can be stated in different formats also in front of total etc, usually at the bottom of the document. EVERY DOC HAS IT, so try again if you can not find it.
- Return only the fields in this exact format:

po_number: ...
vendor_name: ...
date: ...
total_amount: ...
"""


def build_grn_prompt() -> str:
    return """You are an intelligent Goods Receipt Note (GRN) processing assistant.

Extract exactly the following fields from the GRN document image:

- grn_number
- vendor_name
- po_number  # to link back to the PO
- date
- total_amount

Please follow these rules:
- Extract grn_number and po_number exactly as they appear. DO NOT CONFUSE AN O with a 0. example: GRN004 should not be taken as GRN0004.
- Dates should be returned in YYYY-MM-DD format if legible; otherwise blank.
- vendor_name should be the name of the vendor or supplier mostly written with address (not always the name of the company, AND ADDRESS IS NOT PART OF VENDOR NAME for example: "Supplier XYZ" not "Supplier XYZ, JALANDAR A, India")
- The total amount should be accurate and match the document.
- Return only the fields in this exact format:

grn_number: ...
vendor_name: ...
po_number: ...
date: ...
total_amount: ...
"""


def build_doc_type_prompt() -> str:
    return '''
You are a **very intelligent document–type classifier**, highly skilled at understanding and categorizing business documents from images.

INPUT  
• Exactly *one* page image (may be scanned, rotated, low-resolution, stamped).  
• The file name may be misleading—**ignore it**; decide only from visible text / layout.

DECISION SET  (all caps, choose one)

  INVOICE
  PROOF_OF_PAYMENT        (bank cheque or labour-waiver / payment voucher)
  SUMMARY                 (summary-of-invoices table)
  PURCHASE_ORDER          (PO)
  GRN                     (Goods Receipt Note)

──────────────────────────────────────────
STRONG CUES  (use ≥2 cues if title words are missing or in another language)

| TYPE | Common titles / synonyms | Layout & field hints |
|------|--------------------------|----------------------|
| **INVOICE** | “Invoice”, “Tax Invoice”, “Bill To”, «Factura», ‹Fattura› | One vendor, one **invoice number**, totals section, “Subtotal / Tax / Total Due” |
| **PROOF_OF_PAYMENT** | “Cheque”, “Check”, “Payment Voucher”, “Labour Waiver”, “Payee” | **Amount in words**, bank logo, MICR line, authorised signatures, or waiver grid |
| **SUMMARY** | “Invoice Register”, “Schedule of Invoices”, “Invoice Summary” | Large table: **Invoice ID / Vendor / Date / Total / Cheque No** columns, many lines |
| **PURCHASE_ORDER** | “Purchase Order”, “Order Form”, “Supplier Order”, «Orden de Compra» | PO number, ship-to / deliver-to blocks, line-items with qty-unit-price, grand total |
| **GRN** | “Goods Receipt Note”, “Receiving Report”, “GRR”, «Nota de Recepción» | **GRN No + PO No**, received qty, inspection/warehouse stamps, “Accepted / Rejected” |

Edge cases to resolve:  
• If a **cheque image** also shows an “Invoice No” stamp → classify as **PROOF_OF_PAYMENT** (amount-in-words outweighs).  
• If the page looks like an *invoice table* but spans many vendors → **SUMMARY**.  
• If both “Purchase Order” and “Goods Receipt” appear, use the presence of received/accepted quantities → **GRN**.  
• Hand-written “Paid” or bank cancel stamp does **not** turn an invoice into a proof.

OUTPUT (strict)  
Return **one single line of JSON, no markdown, no comments**:

    {"doc_type": "<ONE_OF_THE_FIVE_VALUES_ABOVE>"}

Examples:  
    {"doc_type": "SUMMARY"}  
    {"doc_type": "GRN"}
'''


def build_insight_prompt(table_text: str, report_type: str | None = None) -> str:
    """
    Ask GPT-4o for a structured Markdown insight:

    • ## Key Metrics      – single YAML block with numeric KPIs
    • ## Executive Summary
    • ## Actionable Insights – bullet list
    """
    friendly = {
        "INVOICE_RECON": "Invoice-Proof-Summary reconciliation report",
        "CHEQUE_UTIL":   "Cheque utilisation report",
        "INV_SUM":       "Invoice ↔ Summary reconciliation report",
        "PROOF_SUM":     "Proof ↔ Summary reconciliation report",
        "PO_GRN":        "PO ↔ GRN reconciliation report",
    }
    type_hint = friendly.get(report_type, "")

    return dedent(f"""
    SYSTEM ROLE
    You are a senior finance-operations analyst. Turn the reconciliation
    table into a concise, **structured** executive summary.

    OUTPUT FORMAT (Markdown **only** ─ no code fences):
      ## Key Metrics
      ---
      total_records:    <int>
      matched_records:  <int>
      mismatch_records: <int>
      match_rate_pct:   <float>
      biggest_amount_variance: "<id or value>"
      ---
      ## Executive Summary
      <two short paragraphs…>

      ## Actionable Insights
      - <bullet 1>
      - <bullet 2>
      - …

    RULES
    • The YAML block must be valid: 3 dashes on their own line top & bottom.
    • Do not invent fields; compute only from the data provided.
    • Use thousands separators (1,234.56) where appropriate.
    • Professional tone; no “As an AI…” remarks.

    EXPLICIT REPORT TYPE HINT (may be blank): {type_hint}

    TABLE
    {table_text}
    """)
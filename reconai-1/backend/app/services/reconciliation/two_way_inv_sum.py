"""
two_way_inv_sum.py
------------------
Two-way reconciliation:  Invoices  ↔  Summary Sheet
• Accepts one or many invoice files (PDF / image) + a summary XLSX/CSV.
• Outputs a DataFrame (and optional Excel) flagging: Missing Invoice,
  Missing in Summary, Amount Mismatch, Vendor Mismatch, Matched.
"""

# libraries imports
from pathlib import Path
from typing import List
import pandas as pd
from datetime import datetime


# local imports
from ..extraction.text_extraction import extract_invoice_fields
from ..utils.id_utils import normalize_id_column, llm_vendor_match_check
from ..normalization.normalization import (
    standardize_summary_columns_with_llm,
    normalize_summary_values,
    normalize_extracted_invoices,
)
from ...config import llm                    


MODULE_DIR = Path(__file__).resolve().parent.parent.parent
BASE_OUTPUT_DIR = MODULE_DIR / "output" / "inv_sum_reconciliation"
BASE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def ingest_invoices(file_paths: List[str | Path]) -> pd.DataFrame:
    """
    Loop through all invoice files and return a canonical DataFrame.
    """
    records = []
    for f in file_paths:
        try:
            fields = extract_invoice_fields(f)
            records.append(fields)
        except Exception as e:
            print(f"[WARN] Could not extract {f}: {e}")
    return pd.DataFrame(records)


def ingest_summary(summary_path: str | Path) -> pd.DataFrame:
    """
    Read Excel/CSV summary and return canonical DataFrame.
    """
    p = Path(summary_path)
    if p.suffix.lower() in [".xlsx", ".xls"]:
        df = pd.read_excel(p)
    else:
        df = pd.read_csv(p)

    df = standardize_summary_columns_with_llm(df)
    df = normalize_summary_values(df)
    return df


def match_inv_summary(invoice_df: pd.DataFrame, summary_df: pd.DataFrame) -> pd.DataFrame:
    """
    Return merged DataFrame with issue flags.
    """
    invoice_df = invoice_df.copy()
    summary_df = summary_df.copy()

    # Normalize IDs
    invoice_df["invoice_id"] = normalize_id_column(invoice_df["invoice_id"])
    summary_df["invoice_id"] = normalize_id_column(summary_df["invoice_id"])

    # outer-join on invoice_id
    merged = pd.merge(
        invoice_df,
        summary_df,
        on="invoice_id",
        how="outer",
        suffixes=("_inv", "_sum"),
        indicator=True,
    )

    merged["uploaded_invoice"] = merged["_merge"] != "right_only"

    # amount mismatch
    merged["amount_mismatch"] = (
        (merged["total_amount"].fillna(-1) - merged["invoice_total"].fillna(-1)).abs() > 0.01
    )

    # vendor mismatch (use LLM only where both vendors present)
    def vendor_flag(row):
        if pd.isna(row["vendor_name_inv"]) or pd.isna(row["vendor_name_sum"]):
            return True  # treat missing as mismatch later via other flags
        return llm_vendor_match_check(llm, row["vendor_name_inv"], row["vendor_name_sum"])

    merged["vendor_match"] = merged.apply(vendor_flag, axis=1)

    # final issue column
    def resolve_issue(row):
        if row["_merge"] == "left_only":
            return "Missing in Summary"
        if row["_merge"] == "right_only":
            return "Missing Invoice"
        issues = []
        if row["amount_mismatch"]:
            issues.append("Amount Mismatch")
        if not row["vendor_match"]:
            issues.append("Vendor Mismatch")
        return "Matched" if not issues else "; ".join(issues)

    merged["issues"] = merged.apply(resolve_issue, axis=1)


    merged = merged.rename(columns={
    "total_amount":  "total_amount_inv",
    "invoice_total": "total_amount_sum"
    })

    # housekeeping
    cols_out = [
        "invoice_id",
        "uploaded_invoice", 
        "vendor_name_inv",
        "vendor_name_sum",
        "total_amount_inv",
        "total_amount_sum",
        "issues",
    ]

    # Only keep rows for invoices that were uploaded by the user
    merged = merged[merged["uploaded_invoice"]]

    return merged[cols_out]


def run(invoice_files: List[str | Path], summary_path: str | Path,
        excel_output: str | None = None) -> pd.DataFrame:
    """
    Main callable: returns result DataFrame and optionally writes Excel.
    """
    invoices_raw = ingest_invoices(invoice_files)
    invoices_norm = normalize_extracted_invoices(invoices_raw)

    summary_norm = ingest_summary(summary_path)

    result_df = match_inv_summary(invoices_norm, summary_norm)

    if excel_output:
        Path(excel_output).parent.mkdir(parents=True, exist_ok=True)
        result_df.to_excel(excel_output, index=False)
        print(f"Invoice-Summary report written to {excel_output}")

    return result_df


if __name__ == "__main__":
    import argparse, glob

    parser = argparse.ArgumentParser(
        description="Two-way Invoice ↔ Summary reconciliation")
    
    parser.add_argument(
        "--invoices",
        required=True,
        nargs='+',                             # ← accept 1-N values
        help="One or more invoice files OR glob patterns"
    )
    parser.add_argument("--summary", required=True,
                        help="Path to summary Excel/CSV")
    parser.add_argument("--out", default=None,
                        help="Optional explicit output path")
    args = parser.parse_args()

    invoice_paths: list[Path] = []
    for pattern in args.invoices:
        invoice_paths.extend(Path(p) for p in glob.glob(pattern))

    # build default name with timestamp if --out not supplied
    if args.out is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.out = f"{BASE_OUTPUT_DIR}/Invoice-Summary_{ts}.xlsx"

    run(invoice_paths, Path(args.summary), excel_output=args.out)

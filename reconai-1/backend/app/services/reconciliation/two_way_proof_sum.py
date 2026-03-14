"""
two_way_proof_sum.py
--------------------
Two-way reconciliation:  Proofs  ↔  Summary Sheet
• Accepts one or many proof files (PDF / image) + a summary XLSX/CSV.
• Produces a DataFrame and optionally an Excel file with the columns:
  proof_id | party_name | amount_numeric | sum_invoice_total |
  amount_match | vendor_match | issues
"""

# libraries imports
from pathlib import Path
from typing import List
from datetime import datetime
import pandas as pd

# local imports
from ..extraction.text_extraction import extract_proof_fields
from ..normalization.normalization import (
    standardize_summary_columns_with_llm,
    normalize_summary_values,
    normalize_extracted_proofs,
)
from ..utils.id_utils import normalize_id_column, llm_vendor_match_check
from ...config import llm


MODULE_DIR = Path(__file__).resolve().parent.parent.parent
BASE_OUTPUT_DIR = MODULE_DIR / "output" / "proof_sum_reconciliation"
BASE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ingestion helpers
def ingest_proofs(file_paths: List[str | Path]) -> pd.DataFrame:
    records = []
    for f in file_paths:
        try:
            rec = extract_proof_fields(f)
            records.append(rec)
        except Exception as e:
            print(f"[WARN] Could not extract {f}: {e}")
    return pd.DataFrame(records)


def ingest_summary(summary_path: str | Path) -> pd.DataFrame:
    path = Path(summary_path)
    df = pd.read_excel(path) if path.suffix.lower() in (".xlsx", ".xls") else pd.read_csv(path)
    df = standardize_summary_columns_with_llm(df)
    df = normalize_summary_values(df)
    return df


# core matcher  –  Proof  ↔  Summary
def match_proof_summary(proof_df: pd.DataFrame,
                         summary_df: pd.DataFrame) -> pd.DataFrame:
    proof_df   = proof_df.copy()
    summary_df = summary_df.copy()

    # clean IDs
    proof_df["proof_id"]        = normalize_id_column(proof_df["proof_id"])
    summary_df["cheque_number"] = summary_df["cheque_number"].astype(str)

    # explode cheque numbers in summary
    link_df = (
        summary_df
        .assign(cheque_number=summary_df["cheque_number"].str.split(','))
        .explode("cheque_number")
        .assign(cheque_number=lambda d:
                normalize_id_column(d["cheque_number"].str.strip()))
    )

    # aggregate invoice totals per cheque
    inv_sum = (
        link_df.groupby("cheque_number", dropna=False)["invoice_total"]
               .sum(min_count=1)
               .rename("sum_invoice_total")
               .reset_index()
    )

    # concatenate vendors per cheque
    vendors = (
        link_df.groupby("cheque_number", dropna=False)["vendor_name"]
               .apply(lambda s: ", ".join(s.dropna().unique()))
               .rename("vendors_concat")
               .reset_index()
    )
    print(f"[INFO] Found {len(vendors)} unique cheque numbers with vendors")
    # print vendor names
    print(vendors["vendors_concat"].to_string(index=False))

    # merge proofs with summary
    merged = (
        proof_df
        .merge(inv_sum,    left_on="proof_id", right_on="cheque_number",
               how="outer", indicator=True)
        .merge(vendors,    left_on="proof_id", right_on="cheque_number", how="left")
    )

    # back-fill missing proof IDs
    # If the row came only from the summary side (_merge == right_only),
    # proof_id is NaN.  Replace it with the cheque_number so the ID is visible.
    if "cheque_number_x" in merged.columns:        # mergers create *_x / *_y
        cheque_col = "cheque_number_x"
    elif "cheque_number" in merged.columns:
        cheque_col = "cheque_number"
    else:                                          # fallback to whichever exists
        cheque_col = [c for c in merged.columns if "cheque_number" in c][0]

    merged["proof_id"] = merged["proof_id"].fillna(merged[cheque_col])

    # flags
    merged["missing_in_summary"] = merged["_merge"] == "left_only"
    merged["missing_proof"]      = merged["_merge"] == "right_only"

    merged["amount_match"] = (
        (merged["amount_numeric"].fillna(-1) -
         merged["sum_invoice_total"].fillna(-1)).abs() < 0.01
    )

    def vendor_ok(row):
        if pd.isna(row["party_name"]) or pd.isna(row["vendors_concat"]):
            return False
        return llm_vendor_match_check(llm, row["party_name"], row["vendors_concat"])

    merged["vendor_match"] = merged.apply(vendor_ok, axis=1)

    # issue label 
    def decide(row):
        if row["missing_in_summary"]:
            return "Missing in Summary"
        if row["missing_proof"]:
            return "Missing Proof"
        if pd.isna(row["sum_invoice_total"]) or row["sum_invoice_total"] == 0:
            return "Unused Cheque"

        issues = []
        if not row["amount_match"]:
            issues.append("Amount Mismatch")
        if not row["vendor_match"]:
            issues.append("Vendor Mismatch")
        return "Matched" if not issues else "; ".join(issues)

    merged["issues"] = merged.apply(decide, axis=1)

    # final column selection
    cols = [
        "proof_id",               # now always populated
        "party_name",
        "amount_numeric",
        "sum_invoice_total",
        "amount_match",
        "vendor_match",
        "issues",
    ]
    
    # Filter out rows that only exist in the summary (i.e., missing_proof == True)
    filtered = merged[~merged["missing_proof"]]

    return filtered[cols]


# public runner
def run(proof_files: List[str | Path], summary_path: str | Path,
        excel_output: str | None = None) -> pd.DataFrame:

    print("Reconciliation starts: Proofs ↔ Summary")

    proofs_raw  = ingest_proofs(proof_files)
    proofs_norm = normalize_extracted_proofs(proofs_raw)

    summary_norm = ingest_summary(summary_path)

    result_df = match_proof_summary(proofs_norm, summary_norm)

    if excel_output:
        Path(excel_output).parent.mkdir(parents=True, exist_ok=True)
        result_df.to_excel(excel_output, index=False)
        print(f"Proof-Summary report written to {excel_output}")

    print(f"Reconciliation complete: {len(result_df)} records")

    return result_df


# CLI entry-point
if __name__ == "__main__":
    import argparse, glob

    ap = argparse.ArgumentParser(description="Two-way Proof ↔ Summary reconciliation")
    ap.add_argument(
        "--proofs", required=True, nargs='+',
        help="One or more proof files (PDF / image) or glob patterns"
    )
    ap.add_argument("--summary", required=True, help="Path to summary Excel/CSV")
    ap.add_argument("--out", default=None, help="Optional explicit output path")
    args = ap.parse_args()

    proof_paths: list[Path] = []
    for pattern in args.proofs:
        proof_paths.extend(Path(p) for p in glob.glob(pattern))

    if args.out is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.out = str(BASE_OUTPUT_DIR / f"Proof-Summary_{ts}.xlsx")

    run(proof_paths, Path(args.summary), excel_output=args.out)
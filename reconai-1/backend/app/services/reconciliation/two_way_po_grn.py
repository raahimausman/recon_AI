"""
PO  ↔  GRN reconciliation
------------------------
Call `run_po_grn_match(po_df, grn_df)` with two *in-memory* DataFrames.

If you still need an Excel artefact, pass excel_output="…/file.xlsx".
"""

# libraries imports
from pathlib import Path
import pandas as pd
from langchain_core.messages import HumanMessage

# local imports
from ...config      import llm
from ..utils.prompt_builder  import build_vendor_match_prompt
from ..normalization.normalization import (
    normalize_po,
    normalize_grn,
)

# ──────────────────────────────────────────────────────────────────────────────
def _llm_vendor_eq(v1: str | None, v2: str | None) -> bool:
    """True if LLM thinks the two vendor names refer to same entity."""
    if not v1 or not v2:
        return False
    prompt = build_vendor_match_prompt(vendor_name=v1, party_name=v2)
    resp   = llm.invoke([HumanMessage(content=prompt)]).content.strip().lower()
    return resp.startswith("yes")


def _prep_df(df: pd.DataFrame, which: str) -> pd.DataFrame:
    """
    Normalise + basic cleaning for PO or GRN DF.
    `which` = "po" | "grn"
    """
    fn = normalize_po if which == "po" else normalize_grn
    df = fn(df)                               # run your existing normaliser
    df["po_number"] = (
        df["po_number"]
          .astype(str).str.strip().str.upper()
          .str.replace(r"\.0$", "", regex=True)
    )
    # force numeric
    df["total_amount"] = pd.to_numeric(df["total_amount"], errors="coerce")
    return df


# ──────────────────────────────────────────────────────────────────────────────
def run_po_grn_reconciliation(
    po_df: pd.DataFrame,
    grn_df: pd.DataFrame,
    *,
    excel_output: str | Path | None = None,
) -> pd.DataFrame:
    """
    Core matcher.  Returns a reconciliation DataFrame; optionally writes XLSX.
    """

    po_df  = _prep_df(po_df,  "po")
    grn_df = _prep_df(grn_df, "grn")

    #merge on PO number
    merged = pd.merge(
        po_df,
        grn_df[["po_number", "vendor_name", "total_amount"]],
        on="po_number",
        how="left",
        suffixes=("_po", "_grn"),
    )

    #amount flag
    merged["amount_match"] = (
        (merged["total_amount_po"] - merged["total_amount_grn"]).abs() < 0.01
    )

    #vendor flag (LLM only when both present)
    def _vendor_ok(row):
        return _llm_vendor_eq(row["vendor_name_po"], row["vendor_name_grn"])

    merged["vendor_match"] = merged.apply(_vendor_ok, axis=1)

    #composite status
    def _status(r):
        issues = []
        if pd.isna(r["total_amount_grn"]):
            return "Missing GRN"
        if not r["amount_match"]:
            issues.append("Amount Mismatch")
        if not r["vendor_match"]:
            issues.append("Vendor Mismatch")
        return "Matched" if not issues else "; ".join(issues)

    merged["status"] = merged.apply(_status, axis=1)

    #aggregate (one row per PO)
    report = (
        merged.groupby("po_number", as_index=False)
              .agg(
                  vendor_name=("vendor_name_po", "first"),
                  total_amount=("total_amount_po", "first"),
                  status=("status", lambda s: (
                      "Fully Matched" if all(x == "Matched" for x in s)
                      else "; ".join(sorted(set(s)))
                  )),
              )
    )

    # optionally write Excel
    if excel_output:
        Path(excel_output).parent.mkdir(parents=True, exist_ok=True)
        report.to_excel(excel_output, index=False)
        print(f"[INFO] PO-GRN report written to {excel_output}")

    return report
if __name__ == "__main__":
    import argparse, sys
    from ..extraction.text_extraction import process_po_grn   # returns (po_df_raw, grn_df_raw)

    ap = argparse.ArgumentParser(
        description="Ad-hoc PO ↔ GRN reconciliation (in-memory)")

    ap.add_argument("package",
                    help="Name of the folder inside backend/po_grn/data/ (or wherever ROOT points)")
    ap.add_argument("--out",
                    help="Optional path for the XLSX report. "
                         "If omitted, nothing is written to disk.")

    args = ap.parse_args()
    pkg_name = args.package
    try:
        # run Vision + parsing – returns two DataFrames
        po_df_raw, grn_df_raw = process_po_grn(pkg_name)

        # normalise + match  →  final report DataFrame
        report_df = run_po_grn_reconciliation(po_df_raw, grn_df_raw)

        # optional XLSX write-out
        if args.out:
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            report_df.to_excel(args.out, index=False)
            print(f"Report written to {args.out}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
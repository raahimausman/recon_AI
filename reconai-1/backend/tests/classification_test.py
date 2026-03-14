#!/usr/bin/env python3
"""
Bulk tester for   POST /classify/?expected_type=…
-------------------------------------------------
Reads cases.csv (file_path, expected_type) and tests each document
individually.  Results → CSV / XLSX + printed accuracy.

Usage
-----
python classification_test.py \
    --endpoint http://127.0.0.1:8000/classify/ \
    --cases    cases.csv \
    --out      eval_21Jul
"""
from __future__ import annotations

import argparse
import mimetypes
import sys
from pathlib import Path
from typing import List, Tuple

import pandas as pd
import requests
from requests import Response
from tqdm import tqdm

EXPECTED_DOC_TYPES = {
    "INVOICE",
    "PROOF_OF_PAYMENT",
    "SUMMARY",
    "PURCHASE_ORDER",
    "GRN",
}
TIMEOUT = 60


# ───────────────────────── HTTP helpers ──────────────────────────
def call_classify(path: Path, exp_type: str, endpoint: str) -> Response:
    """Upload *one* document with required expected_type parameter."""
    mime, _ = mimetypes.guess_type(str(path))
    mime = mime or "application/octet-stream"

    with path.open("rb") as fh:
        files = {"files": (path.name, fh, mime)}
        resp = requests.post(
            endpoint,
            params={"expected_type": exp_type},
            files=files,
            timeout=TIMEOUT,
        )
    resp.raise_for_status()
    return resp


def extract_detected_type(resp: Response) -> str:
    """Endpoint returns a list[dict]; take detected_type of first item."""
    data = resp.json()
    if not isinstance(data, dict) or "results" not in data:
        raise ValueError("Unexpected response schema")
    return data["results"][0]["detected_type"]


# ───────────────────────── CSV handling ──────────────────────────
def load_cases(csv_path: Path) -> List[Tuple[Path, str]]:
    df = pd.read_csv(csv_path)
    if {"file_path", "expected_type"} - set(df.columns):
        sys.exit("CSV must have columns: file_path, expected_type")

    cases: List[Tuple[Path, str]] = []
    for _, row in df.iterrows():
        p = Path(row["file_path"])
        if not p.exists():
            print(f"[WARN] file not found: {p}", file=sys.stderr)
        exp = str(row["expected_type"]).upper().strip()
        if exp not in EXPECTED_DOC_TYPES:
            print(f"[WARN] unknown expected_type '{exp}' in CSV", file=sys.stderr)
        cases.append((p, exp))
    return cases


# ───────────────────────── main evaluation ───────────────────────
def evaluate(cases: List[Tuple[Path, str]], endpoint: str) -> pd.DataFrame:
    rows = []
    for path, exp in tqdm(cases, desc="Classifying"):
        try:
            r = call_classify(path, exp, endpoint)
            pred = extract_detected_type(r)
            ok = pred == exp
            err = ""
        except Exception as e:
            pred, ok, err = "ERROR", False, str(e)

        rows.append(
            {
                "file": str(path),
                "expected": exp,
                "predicted": pred,
                "match": ok,
                "error": err,
            }
        )
    return pd.DataFrame(rows)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", required=True, help="URL of /classify/")
    ap.add_argument("--cases", required=True, help="CSV with file_path,expected_type")
    ap.add_argument("--out", default="classification_results", help="basename for output")
    args = ap.parse_args(argv)

    cases = load_cases(Path(args.cases))
    df = evaluate(cases, args.endpoint)

    acc = df["match"].mean()
    total = len(df)
    print(f"\n=== classification accuracy: {acc:.2%} ({df['match'].sum()}/{total}) ===")

    df.to_csv(f"{args.out}.csv", index=False)
    try:
        df.to_excel(f"{args.out}.xlsx", index=False)
    except ImportError:
        print("[INFO] openpyxl not installed; only CSV written", file=sys.stderr)


if __name__ == "__main__":
    main()



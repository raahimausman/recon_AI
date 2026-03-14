# backend/api/routers/three_way.py
"""
Three-way reconciliation: Invoice ↔ Proof-of-Payment ↔ Summary-of-Invoices
• Accepts one summary sheet  (.xlsx/.xls/.csv)
• Accepts ≥1 invoice docs         (PDF / image)
• Accepts ≥1 proof-of-payment docs (PDF / image)
→ Runs the existing three-way-matching logic and streams back the Excel report
   “Inv-Proof-Sum-Recon_<timestamp>.xlsx”
"""

from __future__ import annotations

import base64, io, pathlib, logging, os, tempfile
from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import (
    APIRouter, UploadFile, File,
    BackgroundTasks, HTTPException
)
from fastapi.responses import FileResponse
from PIL import Image
from pdf2image import convert_from_bytes
import pandas as pd
from langchain_core.messages import HumanMessage

# ── project imports ────────────────────────────────────────────────────────────
from ...config import llm
from ...services.utils.prompt_builder import (
    build_invoice_prompt,
    build_proof_prompt,
)
from ...services.normalization.normalization import (
    standardize_summary_columns_with_llm,
    normalize_summary_values,
    normalize_extracted_invoices,
    normalize_extracted_proofs,
)
from ...services.reconciliation import three_way_pkg_matching as tw_mod
# ───────────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/inv-proof-sum", tags=["invoice-proof-summary"])

POPPLER_BIN =r"C:\Users\ayesha.gull\Downloads\poppler-24.08.0\Library\bin"

IMG_EXT   = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"}
PDF_EXT   = {".pdf"}
INV_EXT   = IMG_EXT | PDF_EXT
PROOF_EXT = IMG_EXT | PDF_EXT
SUM_EXT   = {".xlsx", ".xls", ".csv"}

# location where three_way_pkg_matching writes its outputs
MATCH_OUT_DIR = pathlib.Path(__file__).resolve().parents[2] / "ip_summary" / "output" / "three_way_reconciliation"


# ═══════════════════════════  Helpers  ═════════════════════════════════════════

def _stitch_vertically(pages: list[Image.Image]) -> Image.Image:
    h_tot = sum(p.height for p in pages)
    w_max = max(p.width  for p in pages)
    canvas = Image.new("RGB", (w_max, h_tot), "white")
    y = 0
    for p in pages:
        canvas.paste(p, (0, y))
        y += p.height
    return canvas


def _pil_from_bytes(name: str, raw: bytes) -> Image.Image:
    suf = pathlib.Path(name).suffix.lower()
    if suf in PDF_EXT:
        pages = convert_from_bytes(raw, poppler_path=POPPLER_BIN)
        return _stitch_vertically(pages) if len(pages) > 1 else pages[0]
    if suf in IMG_EXT:
        return Image.open(io.BytesIO(raw))
    raise ValueError(f"Unsupported file format: {name}")


def _ocr_invoice(name: str, raw: bytes) -> dict:
    img = _pil_from_bytes(name, raw)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    prompt = build_invoice_prompt()
    reply  = llm.invoke([HumanMessage(content=[
        {"type": "text",      "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}" }}
    ])]).content

    fields = {"invoice_id": None, "vendor_name": None,
              "date": None, "total_amount": None, "filename": name}
    for ln in reply.splitlines():
        if ":" in ln:
            k, v = [x.strip() for x in ln.split(":", 1)]
            k = k.lower()
            if k in fields: fields[k] = v
    return fields


def _ocr_proof(name: str, raw: bytes) -> dict:
    img = _pil_from_bytes(name, raw)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    prompt = build_proof_prompt()
    reply  = llm.invoke([HumanMessage(content=[
        {"type": "text",      "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}" }}
    ])]).content

    fields = {
        "proof_type": None, "proof_id": None, "date": None,
        "party_name": None, "amount_numeric": None,
        "amount_words": None, "bank_name": None, "filename": name,
    }
    for ln in reply.splitlines():
        if ":" in ln:
            k, v = [x.strip() for x in ln.split(":", 1)]
            k = k.lower()
            if k in fields: fields[k] = v
    return fields


def _rm(path: pathlib.Path | str):
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


# ═══════════════════════════  Endpoint  ════════════════════════════════════════
@router.post(
    "/",
    summary="Run Invoice-Proof-Summary 3-way reconciliation and download the XLSX report",
    responses={
        200: {"content":
              {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}}},
        400: {"description": "Bad request"},
        415: {"description": "Unsupported media type"},
        500: {"description": "Server error"},
    },
)
async def inv_proof_sum_reconcile(
    background_tasks: BackgroundTasks,
    summary_file : UploadFile       = File(..., description="Summary of Invoices (XLSX / CSV)"),
    invoice_files: List[UploadFile] = File(..., description="1-N invoice docs (PDF / image)"),
    proof_files  : List[UploadFile] = File(..., description="1-N cheque / waiver docs (PDF / image)"),
):
    # 1 ── validation -----------------------------------------------------------
    sum_ext = pathlib.Path(summary_file.filename).suffix.lower()
    if sum_ext not in SUM_EXT:
        raise HTTPException(415, "Summary must be .xlsx, .xls or .csv")

    if not invoice_files or not proof_files:
        raise HTTPException(400, "Upload at least one invoice AND one proof file")

    bad_inv = [f.filename for f in invoice_files if pathlib.Path(f.filename).suffix.lower() not in INV_EXT]
    bad_prf = [f.filename for f in proof_files   if pathlib.Path(f.filename).suffix.lower() not in PROOF_EXT]
    if bad_inv or bad_prf:
        raise HTTPException(
            415,
            f"Unsupported file type(s): {', '.join(bad_inv+bad_prf)}"
        )

    # 2 ── OCR invoices ---------------------------------------------------------
    inv_raw, inv_failed = [], []
    for uf in invoice_files:
        data = await uf.read()
        try:
            inv_raw.append(_ocr_invoice(uf.filename, data))
        except Exception as e:
            logging.warning("Invoice OCR failed for %s: %s", uf.filename, e)
            inv_failed.append(uf.filename)
    if not inv_raw:
        raise HTTPException(400, f"Could not parse any invoice; first failure: {inv_failed[0]}")

    inv_df = normalize_extracted_invoices(pd.DataFrame(inv_raw))

    # 3 ── OCR proofs -----------------------------------------------------------
    prf_raw, prf_failed = [], []
    for uf in proof_files:
        data = await uf.read()
        try:
            prf_raw.append(_ocr_proof(uf.filename, data))
        except Exception as e:
            logging.warning("Proof OCR failed for %s: %s", uf.filename, e)
            prf_failed.append(uf.filename)
    if not prf_raw:
        raise HTTPException(400, f"Could not parse any proof; first failure: {prf_failed[0]}")

    prf_df = normalize_extracted_proofs(pd.DataFrame(prf_raw))

    # 4 ── read + normalise summary --------------------------------------------
    sum_bytes = await summary_file.read()
    with tempfile.NamedTemporaryFile(suffix=sum_ext, delete=False) as tmp_sum:
        tmp_sum.write(sum_bytes)
        tmp_sum_path = pathlib.Path(tmp_sum.name)
    background_tasks.add_task(_rm, tmp_sum_path)      # clean later

    summary_df = (
        pd.read_excel(tmp_sum_path) if sum_ext in {".xlsx", ".xls"}
        else pd.read_csv(tmp_sum_path)
    )
    summary_df  = standardize_summary_columns_with_llm(summary_df)
    summary_df  = normalize_summary_values(summary_df)

    pkg = uuid4().hex[:8]
    
    # ── 5  run reconciliation completely in-memory ────────────────────────────
    pkg = uuid4().hex[:8]                                      # e.g. ab12cd34

    with tempfile.TemporaryDirectory(prefix="tw_out_") as tmpdir_str:
        tmpdir = pathlib.Path(tmpdir_str)

        # Monkey-patch the destination path used by three_way_pkg_matching
        tw_mod.BASE_OUTPUT_DIR = tmpdir                        # <- key change

        # run_reconciliation will now write its two XLSX files into tmpdir
        tw_mod.run_reconciliation(summary_df, prf_df, pkg)

        inv_path  = tmpdir / f"{pkg}_invoice_reconciliation_report.xlsx"
        cheq_path = tmpdir / f"{pkg}_cheque_utilization_report.xlsx"

        if not inv_path.exists() or not cheq_path.exists():
            raise HTTPException(500, "Expected output files not found")

        # ── bundle the two sheets into a ZIP kept in memory ───────────────────
        import zipfile
        zip_tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
        with zipfile.ZipFile(zip_tmp, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(inv_path,  arcname=inv_path.name)
            zf.write(cheq_path, arcname=cheq_path.name)

    # tempdir is wiped automatically when we leave the with-block
    background_tasks.add_task(lambda p: os.remove(p), zip_tmp.name)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        path      = zip_tmp.name,
        filename  = f"Inv-Proof-Sum-Recon_{ts}.zip",
        media_type="application/zip",
    )

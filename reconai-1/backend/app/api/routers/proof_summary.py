# backend/api/routers/proof_summary.py
from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from typing import List
from datetime import datetime
import pathlib, tempfile, io, os, logging, base64

from PIL import Image
from pdf2image import convert_from_bytes
import pandas as pd
from langchain_core.messages import HumanMessage

# ── project imports ────────────────────────────────────────────────────────────
from ...config      import llm
from ...services.utils.prompt_builder  import build_proof_prompt
from ...services.reconciliation.two_way_proof_sum import (
    match_proof_summary,                     # core matcher
    normalize_extracted_proofs,              # tidy OCR output
    standardize_summary_columns_with_llm,
    normalize_summary_values,
)
# ───────────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/proof-sum", tags=["proof-summary"])

POPPLER_BIN = r"C:\Users\ayesha.gull\Downloads\poppler-24.08.0\Library\bin"

IMG_EXT   = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
PDF_EXT   = {".pdf"}
PROOF_EXT = IMG_EXT | PDF_EXT
SUM_EXT   = {".xlsx", ".xls", ".csv"}

# ═════════════════════════ helper functions ════════════════════════════════════
def _stitch_vertically(pages: list[Image.Image]) -> Image.Image:
    h_tot = sum(p.height for p in pages)
    w_max = max(p.width  for p in pages)
    canvas = Image.new("RGB", (w_max, h_tot), "white")
    y = 0
    for p in pages:
        canvas.paste(p, (0, y))
        y += p.height
    return canvas


def _pil_from_proof(name: str, raw: bytes) -> Image.Image:
    suf = pathlib.Path(name).suffix.lower()
    if suf in PDF_EXT:
        pages = convert_from_bytes(raw, poppler_path=POPPLER_BIN)
        return _stitch_vertically(pages) if len(pages) > 1 else pages[0]
    if suf in IMG_EXT:
        return Image.open(io.BytesIO(raw))
    raise ValueError(f"Unsupported proof format: {name}")


def _ocr_proof(name: str, raw: bytes) -> dict:
    img = _pil_from_proof(name, raw)
    buf = io.BytesIO(); img.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    prompt = build_proof_prompt()
    msg = HumanMessage(
        content=[
            {"type": "text",      "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
        ]
    )
    resp = llm.invoke([msg]).content

    fields = {
        "proof_id": None, "party_name": None, "date": None,
        "amount_numeric": None, "amount_words": None, "bank_name": None
    }
    for line in resp.splitlines():
        if ":" in line:
            k, v = [x.strip() for x in line.split(":", 1)]
            k = k.lower()
            if k in fields: fields[k] = v
    fields["filename"] = name
    return fields


def _remove_file(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass

# ═════════════════════════════ endpoint ════════════════════════════════════════
@router.post(
    "/",
    summary="Run Proof ↔ Summary reconciliation and return the XLSX report",
    responses={
        200: {"content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}}},
        400: {"description": "Bad request"},
        415: {"description": "Unsupported media type"},
        500: {"description": "Server error"},
    },
)
async def proof_summary_reconcile(
    background_tasks: BackgroundTasks,
    summary_file : UploadFile        = File(..., description="Summary of Invoices (XLSX / CSV)"),
    proof_files  : List[UploadFile]  = File(..., description="One or more proofs (PDF / image)"),
):
    # ── 1 - validate ───────────────────────────────────────────────────────────
    sum_ext = pathlib.Path(summary_file.filename).suffix.lower()
    if sum_ext not in SUM_EXT:
        raise HTTPException(415, "Summary must be .xlsx, .xls or .csv")

    if not proof_files:
        raise HTTPException(400, "At least one proof file is required")

    bad = [pf.filename for pf in proof_files if pathlib.Path(pf.filename).suffix.lower() not in PROOF_EXT]
    if bad:
        raise HTTPException(415, f"Unsupported proof file type(s): {', '.join(bad)}")

    # ── 2 - OCR proofs ─────────────────────────────────────────────────────────
    proofs_raw, failed = [], []
    for pf in proof_files:
        data = await pf.read()
        try:
            proofs_raw.append(_ocr_proof(pf.filename, data))
        except Exception as e:
            logging.warning("[WARN] Could not extract %s: %s", pf.filename, e)
            failed.append(pf.filename)

    if not proofs_raw:
        raise HTTPException(
            400,
            "None of the uploaded proofs could be parsed; "
            f"first error file: {failed[0]}"
        )

    proof_df_norm = normalize_extracted_proofs(pd.DataFrame(proofs_raw))

    # ── 3 - read & normalise summary ───────────────────────────────────────────
    sum_bytes = await summary_file.read()
    with tempfile.NamedTemporaryFile(suffix=sum_ext, delete=False) as tmp_sum:
        tmp_sum.write(sum_bytes)
        tmp_sum_path = pathlib.Path(tmp_sum.name)

    summary_df = (
        pd.read_excel(tmp_sum_path)
        if sum_ext in {'.xlsx', '.xls'} else
        pd.read_csv(tmp_sum_path)
    )
    summary_df = standardize_summary_columns_with_llm(summary_df)
    summary_df = normalize_summary_values(summary_df)

    # ── 4 - reconcile ──────────────────────────────────────────────────────────
    result_df = match_proof_summary(proof_df_norm, summary_df)

    # ── 5 - write XLSX to temp and return ─────────────────────────────────────
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp_xlsx:
        xlsx_path = pathlib.Path(tmp_xlsx.name)
    result_df.to_excel(xlsx_path, index=False)

    background_tasks.add_task(_remove_file, str(xlsx_path))
    background_tasks.add_task(_remove_file, str(tmp_sum_path))

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        path=str(xlsx_path),
        filename=f"Proof-Sum-Recon_{ts}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

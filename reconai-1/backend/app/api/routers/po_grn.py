# backend/api/routers/po_grn.py
"""
Two-way  ❘  Purchase-Order ↔ GRN  reconciliation API
Uses the new in-memory pipeline:
    process_po_grn(package)            → PO / GRN DataFrames
    run_po_grn_reconciliation(po,grn)  → final report DataFrame (+ optional XLSX)
"""

from __future__ import annotations

from fastapi import (
    APIRouter, UploadFile, File,
    BackgroundTasks, HTTPException
)
from fastapi.responses import FileResponse

from typing   import List
from datetime import datetime
import pathlib, tempfile, shutil, logging, os

# ── project imports ────────────────────────────────────────────────────────────
from ...services.extraction.text_extraction   import process_po_grn_bytes     
from ...services.reconciliation.two_way_po_grn    import run_po_grn_reconciliation

# ───────────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/po-grn", tags=["po-grn"])

IMG_EXT  = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"}
PDF_EXT  = {".pdf"}
ALL_DOCS = IMG_EXT | PDF_EXT            


# ═════════════════════════ helper fns ═════════════════════════════════════════
def _check_extensions(files: List[UploadFile], exts: set[str], kind: str):
    bad = [f.filename for f in files
           if pathlib.Path(f.filename).suffix.lower() not in exts]
    if bad:
        raise HTTPException(415, f"Unsupported {kind} file type(s): {', '.join(bad)}")


def _stage_uploads(pkg_dir: pathlib.Path,
                   po_files: List[UploadFile],
                   grn_files: List[UploadFile]) -> None:
    """
    Writes PO_*  /  GRN_* files so `process_po_grn()` can glob them.
    """
    pkg_dir.mkdir(parents=True, exist_ok=True)

    for idx, uf in enumerate(po_files, 1):
        dest = pkg_dir / f"PO_{idx}{pathlib.Path(uf.filename).suffix}"
        dest.write_bytes(uf.file.read())
        uf.file.close()

    for idx, uf in enumerate(grn_files, 1):
        dest = pkg_dir / f"GRN_{idx}{pathlib.Path(uf.filename).suffix}"
        dest.write_bytes(uf.file.read())
        uf.file.close()


def _cleanup_dir(path: pathlib.Path) -> None:
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception as e:
        logging.warning("[CLEAN-UP] Could not delete %s: %s", path, e)


def _remove_file(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


# ═════════════════════════════ endpoint ═══════════════════════════════════════
@router.post(
    "/",
    summary="Run PO ↔ GRN reconciliation and receive the Excel report",
    responses={
        200: {
            "content": {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}
            }
        },
        400: {"description": "Bad request"},
        415: {"description": "Unsupported media type"},
        500: {"description": "Server error"},
    },
)

async def po_grn_reconcile(
    background_tasks: BackgroundTasks,
    po_files : List[UploadFile] = File(..., description="Purchase-Order docs (PDF / image)"),
    grn_files: List[UploadFile] = File(..., description="Goods-Receipt-Note docs"),
):
    # 1 ─ validation ────────────────────────────────────────────────────────────
    if not po_files or not grn_files:
        raise HTTPException(400, "Upload at least one PO file and one GRN file")

    _check_extensions(po_files,  ALL_DOCS, "PO")
    _check_extensions(grn_files, ALL_DOCS, "GRN")

    # ── gather raw bytes & run OCR in-memory ───────────────────────
    po_bytes  = [(uf.filename, await uf.read()) for uf in po_files]
    grn_bytes = [(uf.filename, await uf.read()) for uf in grn_files]

    try:
        po_df_raw, grn_df_raw = process_po_grn_bytes(po_bytes, grn_bytes)
    except Exception as e:
        raise HTTPException(500, f"Image extraction failed: {e}")

    if po_df_raw.empty or grn_df_raw.empty:
        raise HTTPException(400, "Extraction produced empty PO or GRN tables")

    # create a temp XLSX file for the report
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp_xlsx:
        xlsx_path = pathlib.Path(tmp_xlsx.name)

    try:
        run_po_grn_reconciliation(
            po_df_raw,
            grn_df_raw,
            excel_output=xlsx_path            # writes the report here
        )
    except Exception as e:
        # ensure we remove the file if matching failed
        _remove_file(str(xlsx_path))
        raise HTTPException(500, f"Reconciliation failed: {e}")

    # schedule file clean-up after response is sent
    background_tasks.add_task(_remove_file, str(xlsx_path))

    # 4 ─ stream XLSX back to caller ───────────────────────────────────────────
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        path=str(xlsx_path),
        filename=f"PO-GRN-Recon_{ts}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

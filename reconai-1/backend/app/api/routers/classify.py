# backend/api/routers/classify.py
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from pydantic import BaseModel
from uuid import uuid4, UUID
from typing import List
import pathlib, io, base64, json, re, imghdr

from pdf2image import convert_from_bytes
from langchain_core.messages import HumanMessage


from ...services.utils.prompt_builder import build_doc_type_prompt
from ...api.dependencies      import get_llm_client

router = APIRouter(prefix="/classify", tags=["classify"])

# ───────────────────────── response models ─────────────────────────
class FileClassResult(BaseModel):
    file_id       : UUID
    filename      : str
    detected_type : str     # INVOICE | PROOF_OF_PAYMENT | SUMMARY | PURCHASE_ORDER | GRN
    match         : bool

class BatchClassResponse(BaseModel):
    results: List[FileClassResult]

# ───────────────────────────── constants ───────────────────────────
_SUPPORTED_IMG = {"png", "jpeg", "jpg", "bmp", "webp", "tiff"}
_SUPPORTED_PDF = {".pdf"}
_SUPPORTED_TAB = {".xlsx", ".xls", ".csv"}          # “summary” spreadsheets
_DOC_RE        = re.compile(r'"doc_type"\s*:\s*"([A-Z_]+)"')

POPPLER_BIN = r"C:\Users\ayesha.gull\Downloads\poppler-24.08.0\Library\bin"  # adjust as needed

# ───────────────────────────── helpers ─────────────────────────────
def _image_like_to_png(raw: bytes, filename: str) -> bytes:
    """
    Convert first page of PDF → PNG or validate image bytes.
    Returns PNG bytes ready for Vision-LLM.
    """
    suffix = pathlib.Path(filename).suffix.lower()

    # PDF → PNG of page 1
    if suffix in _SUPPORTED_PDF:
        pages = convert_from_bytes(raw, first_page=1, last_page=1,
                                   poppler_path=POPPLER_BIN)
        buf = io.BytesIO()
        pages[0].save(buf, format="PNG")
        return buf.getvalue()

    # Image?
    if imghdr.what(None, raw) in _SUPPORTED_IMG:
        return raw

    raise HTTPException(415, f"Unsupported file type for Vision model: {filename}")


async def _vision_classify(png_bytes: bytes, llm) -> str:
    """Send PNG to Vision-LLM and return DOC_TYPE (upper-case)."""
    img_b64 = base64.b64encode(png_bytes).decode()
    prompt  = build_doc_type_prompt()

    msg = HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {"type": "image_url",
             "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
        ]
    )
    reply = llm.invoke([msg]).content.strip()

    # JSON parse first, fallback regex
    try:
        return json.loads(reply)["doc_type"].upper()
    except Exception:
        m = _DOC_RE.search(reply)
        if not m:
            raise ValueError(f"Could not extract doc_type from model reply: {reply}")
        return m.group(1).upper()

# ───────────────────────────── endpoint ────────────────────────────
@router.post(
    "/",
    response_model = BatchClassResponse,
    summary        = "Classify uploaded documents and compare to expected_type",
)
async def classify_documents(
    expected_type : str,
    files         : List[UploadFile] = File(...),
    llm           = Depends(get_llm_client),
):
    VALID = {"INVOICE", "PROOF_OF_PAYMENT", "SUMMARY",
             "PURCHASE_ORDER", "GRN"}

    expected_type = expected_type.upper()
    if expected_type not in VALID:
        raise HTTPException(400, f"expected_type must be one of {VALID}")

    results: list[FileClassResult] = []

    for uf in files:
        raw = await uf.read()
        suffix = pathlib.Path(uf.filename).suffix.lower()

        # ── NEW: spreadsheets are auto-SUMMARY ─────────────────────
        if suffix in _SUPPORTED_TAB:
            detected = "SUMMARY"
        else:
            try:
                png_bytes = _image_like_to_png(raw, uf.filename)
                detected  = await _vision_classify(png_bytes, llm)
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    500, detail=f"Classification error for {uf.filename}: {e}"
                )

        results.append(
            FileClassResult(
                file_id       = uuid4(),
                filename      = uf.filename,
                detected_type = detected,
                match         = (detected == expected_type),
            )
        )

    return BatchClassResponse(results=results)

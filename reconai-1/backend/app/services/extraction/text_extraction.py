# Step 0: Install Required Libraries through 'pip install --no-deps -r requirements.txt'


# libraries imports
from pathlib import Path
import pathlib
import base64
from PIL import Image
import pandas as pd
from langchain_core.messages import HumanMessage
import sys
from pdf2image import convert_from_path, convert_from_bytes
import base64, io, re
from itertools import chain
import tempfile
import imghdr


# local imports
from ...config import llm
from ..utils.prompt_builder import build_po_prompt, build_grn_prompt, build_doc_type_prompt, build_invoice_prompt, build_proof_prompt


SUPPORTED_IMG = (".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp")
POPPLER_BIN = r"C:\Users\ayesha.gull\Downloads\poppler-24.08.0\Library\bin"


# Functions to extract images from PDF and stitch them vertically
def extract_images_from_pdf(pdf_path):
    """
    Converts all pages in the PDF to PIL Images.
    Returns a list of PIL.Image objects.
    """
    return convert_from_path(str(pdf_path), poppler_path=POPPLER_BIN)


def stitch_images_vertically(images):
    """
    Takes a list of PIL.Image objects and stitches them vertically.
    Returns one single PIL.Image.
    """
    widths = [img.width for img in images]
    heights = [img.height for img in images]
    
    total_height = sum(heights)
    max_width = max(widths)

    stitched_image = Image.new('RGB', (max_width, total_height), color=(255, 255, 255))

    y_offset = 0
    for img in images:
        stitched_image.paste(img, (0, y_offset))
        y_offset += img.height

    return stitched_image


def save_temp_image(image, output_folder, base_name):
    """
    Saves a PIL.Image to a PNG file in a temp folder.
    Returns the Path to the saved image.
    """
    output_folder.mkdir(parents=True, exist_ok=True)
    out_path = output_folder / f"{base_name}.png"
    image.save(out_path)
    return out_path


# Function to encode image to base64
def encode_image_to_base64(image_path: Path) -> str:
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode("utf-8")


# Function to send image and prompt to Azure LLM and return raw output
def get_structured_text_from_image(image_path: Path, doc_type: str) -> str:
    image_b64 = encode_image_to_base64(image_path)

    if doc_type == "invoice":
        prompt_text = build_invoice_prompt()
    elif doc_type == "proof":
        prompt_text = build_proof_prompt()
    else:
        raise ValueError(f"Unsupported document type: {doc_type}")

    message = HumanMessage(
        content=[
            {"type": "text", "text": prompt_text},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}}
        ]
    )

    response = llm.invoke([message])
    return response.content


# Functions to parse structured text into field dictionaries
def parse_invoice_fields(text: str) -> dict:
    fields = {
        "invoice_id": None,
        "vendor_name": None,
        "date": None,
        "total_amount": None
    }
    for line in text.strip().split("\n"):
        if ":" in line:
            key, value = [x.strip() for x in line.split(":", 1)]
            key = key.lower()
            if key in fields:
                fields[key] = value
    return fields


def parse_proof_fields(text: str) -> dict:
    fields = {
        "proof_type": None,
        "proof_id": None,
        "date": None,
        "party_name": None,
        "amount_numeric": None,
        "amount_words": None,
        "bank_name": None
    }
    for line in text.strip().split("\n"):
        if ":" in line:
            key, value = [x.strip() for x in line.split(":", 1)]
            key = key.lower()
            if key in fields:
                fields[key] = value
    return fields


# Main function to process images and export structured data
def process_images(package_name: str):
    
    base_dir = Path("data") / package_name
    invoice_dir = base_dir / "invoices"
    proof_dir = base_dir / "proof_of_payments"

    if not base_dir.exists():
        print(f"Error: Package folder '{package_name}' does not exist.")
        sys.exit(1)
    if not invoice_dir.exists():
        print(f"Error: Subfolder 'invoices' not found in '{package_name}'")
        sys.exit(1)
    if not proof_dir.exists():
        print(f"Error: Subfolder 'proofs' not found in '{package_name}'")
        sys.exit(1)

    print(f"Processing package: {package_name}")

    # Process all invoice images
    print("Processing invoices...")

    invoice_records = []

    with tempfile.TemporaryDirectory(prefix="tmp_img_") as tmpdir_str:
        temp_image_dir = Path(tmpdir_str)

    for f in sorted(invoice_dir.iterdir()):
        suffix = f.suffix.lower()
        if suffix not in (".pdf", *SUPPORTED_IMG):
            print(f"[SKIP] Unsupported file type in invoices: {f.name}")
            continue

        print(f"Processing invoice {f.name}")

        # --- obtain a single PIL image regardless of type -------------
        if suffix == ".pdf":
            pages = extract_images_from_pdf(f)
            img   = stitch_images_vertically(pages) if len(pages) > 1 else pages[0]
        else:                           # native image
            img   = Image.open(f)

        # save temp PNG (so encode_image_to_base64() can read it)
        tmp_path = save_temp_image(img, temp_image_dir, f.stem)

        raw = get_structured_text_from_image(tmp_path, doc_type="invoice")
        parsed = parse_invoice_fields(raw)
        parsed["filename"] = f.name
        invoice_records.append(parsed)

    # Process all proof of payment (cheque or waiver) images
    print("Processing proofs of payment...")

    proof_records = []

    for f in sorted(proof_dir.iterdir()):
        suffix = f.suffix.lower()
        if suffix not in (".pdf", *SUPPORTED_IMG):
            print(f"[SKIP] Unsupported proof file type: {f.name}")
            continue

        print(f"Processing proof {f.name}")

        if suffix == ".pdf":
            pages = extract_images_from_pdf(f)
            img   = stitch_images_vertically(pages) if len(pages) > 1 else pages[0]
        else:
            img   = Image.open(f)

        tmp_path = save_temp_image(img, temp_image_dir, f.stem)

        raw = get_structured_text_from_image(tmp_path, doc_type="proof")
        parsed = parse_proof_fields(raw)
        parsed["filename"] = f.name
        proof_records.append(parsed)


    # Export structured records to Excel files
    invoice_df = pd.DataFrame(invoice_records)
    proof_df = pd.DataFrame(proof_records)

    import os
    os.makedirs("output", exist_ok=True)
    os.makedirs(f"output/extraction", exist_ok=True)
    os.makedirs(f"output/normalization", exist_ok=True)
    os.makedirs(f"output/reconciliation", exist_ok=True)

    if not invoice_df.empty:
        invoice_df.to_excel(f"output/extraction/{package_name}_invoices_output.xlsx", index=False)
    if not proof_df.empty:
        proof_df.to_excel(f"output/extraction/{package_name}_proofs_output.xlsx", index=False)


# Function to extract fields from a single invoice or proof file using LLM

def _pil_from_pdf_or_image(f: Path) -> Image.Image:
    if f.suffix.lower() == ".pdf":
        pages = convert_from_path(str(f), poppler_path=r"C:\Users\ayesha.gull\Downloads\poppler-24.08.0\Library\bin")
        return pages[0] if len(pages) == 1 else pages[0]   # single-page assumed
    elif f.suffix.lower() in SUPPORTED_IMG:
        return Image.open(f)
    else:
        raise ValueError(f"Unsupported format: {f.suffix}")


# Single-file extractor – INVOICE
def extract_invoice_fields(file_path: str | Path) -> dict:
    """
    OCR one invoice file (PDF / image) and return a dict:
    {invoice_id, vendor_name, date, total_amount, filename}
    """
    f = Path(file_path)
    img = _pil_from_pdf_or_image(f)

    # encode image to base64
    buf = io.BytesIO(); img.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    prompt = build_invoice_prompt()
    msg = HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
        ]
    )
    resp = llm.invoke([msg]).content

    # simple key-value parsing
    fields = {"invoice_id": None, "vendor_name": None, "date": None, "total_amount": None}
    for line in resp.splitlines():
        if ":" in line:
            k, v = [x.strip() for x in line.split(":", 1)]
            k = k.lower()
            if k in fields: fields[k] = v
    fields["filename"] = f.name
    return fields


# Single-file extractor – PROOF (cheque / waiver)
def extract_proof_fields(file_path: str | Path) -> dict:
    """
    OCR one proof file (PDF or image) and return a dict with the keys
    proof_type, proof_id, date, party_name, amount_numeric, amount_words,
    bank_name, filename
    """
    f = Path(file_path)
    img = _pil_from_pdf_or_image(f)           

    # encode PIL image to base64-PNG for the vision-LLM call
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    prompt = build_proof_prompt()
    msg = HumanMessage(
        content=[
            {"type": "text",       "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
        ]
    )
    resp = llm.invoke([msg]).content        # GPT-4o Vision response

    # simple key-value parsing
    fields = {
        "proof_type":     None,
        "proof_id":       None,
        "date":           None,
        "party_name":     None,
        "amount_numeric": None,
        "amount_words":   None,
        "bank_name":      None,
    }
    for line in resp.splitlines():
        if ":" in line:
            k, v = [x.strip() for x in line.split(":", 1)]
            k = k.lower()
            if k in fields:
                fields[k] = v
    fields["filename"] = f.name
    return fields

# Single-file extractor – Purchase Order (PO)
def parse_po_fields(text: str) -> dict:
    fields = {
        "po_number": None,
        "vendor_name": None,
        "date": None,
        "total_amount": None
    }

    for line in text.splitlines():
        if ":" not in line:
            continue
        key, val = [x.strip() for x in line.split(":", 1)]
        key = key.lower()
        if key == "total_amount":
            # strip everything except digits, dot, minus
            num = re.sub(r"[^\d\.-]", "", val)
            try:
                fields[key] = float(num) if num else None
            except ValueError:
                fields[key] = None
        elif key in fields:
            fields[key] = val or None

    return fields


# Single-file extractor – Goods Receipt Note (GRN)
def parse_grn_fields(text: str) -> dict:
    fields = {
        "po_number": None,
        "vendor_name": None,
        "date": None,
        "total_amount": None
    }

    for line in text.splitlines():
        if ":" not in line:
            continue
        key, val = [x.strip() for x in line.split(":", 1)]
        key = key.lower()
        if key == "total_amount":
            # strip everything except digits, dot, minus
            num = re.sub(r"[^\d\.-]", "", val)
            try:
                fields[key] = float(num) if num else None
            except ValueError:
                fields[key] = None
        elif key in fields:
            fields[key] = val or None

    return fields

# Functions to extract images from PDF and load document images
def pg_extract_images_from_pdf(pdf_path: Path):
    return convert_from_path(
        str(pdf_path),
        poppler_path=POPPLER_BIN
    )

def pg_load_document_images(path: Path) -> list[Image.Image]:
    """
    If path is a PDF, convert pages to images via pdf2image.
    If it's an image file, open it directly.
    Returns a list of PIL.Image.
    """
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return convert_from_path(
            str(path),
            poppler_path=POPPLER_BIN
        )
    elif suffix in [".png", ".jpg", ".jpeg", ".tiff", ".bmp"]:
        return [Image.open(path)]
    else:
        raise ValueError(f"Unsupported file type: {path}")

import json, re

_DOC_RE = re.compile(
    r'"?doc[_\s-]*type"?\s*[:=]\s*"?(PO|PURCHASE_ORDER|GRN|GOODS_RECEIPT[^"]*)"?',
    re.I
)

def pg_classify_with_llm(image_path: Path) -> str:
    img_b64 = pg_encode_image_to_base64(image_path)
    prompt  = build_doc_type_prompt()

    answer  = llm.invoke([HumanMessage(content=[
                  {"type": "text", "text": prompt},
                  {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
              ])]).content.strip()

    #Attempt JSON first
    try:
        data = json.loads(answer)
        raw  = data.get("DOC_TYPE") or data.get("doc_type")  # tolerate case
        if raw:                                              # continue if found
            answer = raw
            # fall through to normalisation step below
    except Exception:
        pass                                                 # not JSON – keep original

    #Regex inside free-form text
    m = _DOC_RE.search(answer)
    if m:
        answer = m.group(1)

    #Normalise to 'po' / 'grn'
    answer_up = answer.upper().strip()
    if answer_up.startswith("PO") or answer_up.startswith("PURCHASE_ORDER"):
        return "po"
    if answer_up.startswith("GRN") or answer_up.startswith("GOODS_RECEIPT"):
        return "grn"

    raise ValueError(f"Couldn’t classify document (got: {answer!r})")

def pg_stitch_images_vertically(images):
    """
    Stitches a list of PIL Images vertically into one.
    """
    widths = [img.width for img in images]
    heights = [img.height for img in images]
    total_height = sum(heights)
    max_width = max(widths)
    canvas = Image.new('RGB', (max_width, total_height), (255,255,255))
    y_offset = 0
    for img in images:
        canvas.paste(img, (0, y_offset))
        y_offset += img.height
    return canvas


def pg_save_temp_image(image: Image.Image, output_folder: Path, name: str) -> Path:
    output_folder.mkdir(parents=True, exist_ok=True)
    out = output_folder / f"{name}.png"
    image.save(out)
    return out


def pg_encode_image_to_base64(image_path: Path) -> str:
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')
    


# IN-MEMORY helpers – no package folder on disk required

def _pg_load_images_from_bytes(name: str, raw: bytes) -> list[Image.Image]:
    """
    Read PDF/image bytes ➜ list[Image.Image].
    """
    ext = pathlib.Path(name).suffix.lower()
    if ext == ".pdf" or raw[:4] == b"%PDF":
        return convert_from_bytes(raw, poppler_path=POPPLER_BIN)
    if imghdr.what(None, raw):
        return [Image.open(io.BytesIO(raw))]
    raise ValueError(f"Unsupported document format: {name!r}")


def _pg_extract_record(name: str, raw: bytes) -> tuple[str, dict]:
    """
    (filename, bytes) ➜ ('po'|'grn', parsed_fields_dict)
    """
    pages = _pg_load_images_from_bytes(name, raw)
    img   = pg_stitch_images_vertically(pages) if len(pages) > 1 else pages[0]

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        img.save(tmp, format="PNG")
        tmp_path = pathlib.Path(tmp.name)

    try:
        doc_type = pg_classify_with_llm(tmp_path)       # 'po' or 'grn'
        raw_txt  = pg_get_structured_text_from_image(tmp_path, doc_type)
    finally:
        tmp_path.unlink(missing_ok=True)

    if doc_type == "po":
        return "po",  parse_po_fields(raw_txt)
    if doc_type == "grn":
        return "grn", parse_grn_fields(raw_txt)
    raise RuntimeError(f"Unexpected doc_type {doc_type!r}")


def process_po_grn_bytes(
        po_files : list[tuple[str, bytes]],
        grn_files: list[tuple[str, bytes]],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Pure-memory variant of process_po_grn().
    Takes two lists of (filename, raw_bytes).
    """
    po_records, grn_records = [], []

    for name, raw in (*po_files, *grn_files):
        kind, rec = _pg_extract_record(name, raw)
        if kind == "po":
            po_records.append(rec)
        else:
            grn_records.append(rec)

    return pd.DataFrame(po_records), pd.DataFrame(grn_records)


def pg_get_structured_text_from_image(image_path: Path, doc_type: str) -> str:
    img_b64 = pg_encode_image_to_base64(image_path)
    if doc_type == 'po':
        prompt = build_po_prompt()
    elif doc_type == 'grn':
        prompt = build_grn_prompt()
    else:
        raise ValueError(f"Unsupported doc_type: {doc_type}")
    message = HumanMessage(content=[
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
    ])
    resp = llm.invoke([message])
    return resp.content
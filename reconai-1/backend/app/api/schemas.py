# backend/api/schemas.py
from pydantic import BaseModel
from typing import List, Literal
from uuid import UUID

# --- File ingestion & classification ---
class UploadResponse(BaseModel):
    document_ids: List[UUID]

class ClassifyResponse(BaseModel):
    doc_type: Literal["po","grn","invoice","proof","summary"]

# --- Extraction & Normalization ---
class ExtractResponse(BaseModel):
    fields: dict  # raw key→value from your LLM prompts

class NormalizeResponse(BaseModel):
    normalized: dict

# --- Reconciliation requests & responses ---
class PoGrnRequest(BaseModel):
    po_ids: List[UUID]
    grn_ids: List[UUID]

class InvoiceSummaryRequest(BaseModel):
    invoice_ids: List[UUID]
    summary_id: UUID

class ProofSummaryRequest(BaseModel):
    proof_ids: List[UUID]
    summary_id: UUID

class InvoiceProofSummaryRequest(BaseModel):
    invoice_ids: List[UUID]
    proof_ids: List[UUID]
    summary_id: UUID

class ReconcileResponse(BaseModel):
    report_id: UUID

# --- Task status & insights ---
class TaskStatus(BaseModel):
    status: str
    progress: float  # 0.0–1.0

class InsightResponse(BaseModel):
    summary: str

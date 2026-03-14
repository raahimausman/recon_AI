from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import (
    po_grn, 
    invoice_summary,
    proof_summary,
    three_way,
    insights,
    classify
)

app = FastAPI(
    title="Recon AI API",
    version="0.1.0",
    docs_url="/docs", redoc_url=None,
)

app.include_router(po_grn)
app.include_router(classify)
app.include_router(insights)
app.include_router(invoice_summary)
app.include_router(proof_summary)
app.include_router(three_way)
app.include_router(insights)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# backend/api/routers/insights.py
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Form
import pandas as pd, io
from langchain_core.messages import HumanMessage
import zipfile

from ...services.utils.prompt_builder import build_insight_prompt
from ...api.dependencies import get_llm_client
from ...api.schemas import InsightResponse  

router = APIRouter(prefix="/insights", tags=["insights"])

# ────────────────────────────────────────────────
@router.post(
    "/",
    response_model=InsightResponse,
    summary="Return executive summary & actionable insights for a reconciliation sheet",
)
async def generate_insight(
    file: UploadFile = File(...),
    report_type: str | None = Form(None),
    llm = Depends(get_llm_client),
):
    name = file.filename.lower()
    raw = await file.read()

    # --- ZIP support ---
    if name.endswith(".zip"):
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                dfs = []
                for fname in zf.namelist():
                    if fname.endswith((".xlsx", ".xls", ".csv")):
                        with zf.open(fname) as f:
                            if fname.endswith(".csv"):
                                dfs.append(pd.read_csv(f))
                            else:
                                dfs.append(pd.read_excel(f, sheet_name=0))
                if not dfs:
                    raise HTTPException(400, "No Excel/CSV files found in ZIP")
                df = pd.concat(dfs, ignore_index=True)
        except Exception as e:
            raise HTTPException(400, f"Failed to process ZIP: {e}")
    elif name.endswith((".xlsx", ".xls", ".csv")):
        try:
            if name.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(raw))
            else:
                df = pd.read_excel(io.BytesIO(raw), sheet_name=0)
        except Exception as e:
            raise HTTPException(400, f"Unable to parse spreadsheet: {e}")
    else:
        raise HTTPException(415, "Only .xlsx, .xls, .csv, or .zip files are accepted")

    if df.empty:
        raise HTTPException(400, "Uploaded sheet is empty")

    # optional: cap row count to keep prompt small
    if len(df) > 2000:
        raise HTTPException(413, "Sheet too large – limit 2 000 rows")

    # 3. build prompt -------------------------------------------------------
    csv_text = df.to_csv(index=False)
    prompt   = build_insight_prompt(csv_text, report_type and report_type.upper())

    # 4. call LLM -----------------------------------------------------------
    try:
        summary_md = llm.invoke([HumanMessage(content=prompt)]).content.strip()
    except Exception as e:
        raise HTTPException(500, f"LLM insight generation failed: {e}")

    return InsightResponse(summary=summary_md)
# libraries imports
import pandas as pd
from typing import Iterable, Union
from fuzzywuzzy import fuzz
from langchain_core.messages import HumanMessage

# local imports
from .prompt_builder import build_vendor_match_prompt    


# Function to normalize ID columns by removing trailing decimals and whitespace
def normalize_id_column(series) -> pd.Series:
    """
    Converts IDs to clean string without decimals.
    Example: 8201.0 -> '8201'
    """
    return series.astype(str).str.replace(r'\.0$', '', regex=True).str.strip()


# Function to perform fuzzy matching on IDs
def fuzzy_id_match(
    target_id: Union[str, int, None],
    candidate_ids: Iterable[Union[str, int, None]],
    threshold: int = 85,
) -> bool:
    if target_id is None:
        return False

    tgt = str(target_id).strip()
    if not tgt:
        return False

    # quick exact match first
    if tgt in {str(c).strip() for c in candidate_ids if c is not None}:
        return True

    # fuzzy match loop
    for cand in candidate_ids:
        if cand is None:
            continue
        score = fuzz.ratio(tgt, str(cand).strip())
        if score >= threshold:
            return True

    return False


# Function to drop invalid invoices with NaN or 'NAN' invoice_id
def drop_invalid_invoices(df) -> pd.DataFrame:
    before = len(df)
    df = df[df['invoice_id'].notna() & (df['invoice_id'].astype(str).str.upper() != 'NAN')].copy()
    after = len(df)
    print(f"Dropped {before - after} invalid invoice rows with NaN or 'NAN' invoice_id.")
    return df


# Function to check vendor match using LLM
def llm_vendor_match_check(llm, vendor_name, party_name) -> bool:
    prompt = build_vendor_match_prompt(vendor_name, party_name)
    response = llm.invoke([HumanMessage(content=prompt)])
    answer = response.content.strip().lower()

    if "yes" in answer or "YES" in answer:
        return True
    else:
        return False
    

# Function to find missing invoices in the summary compared to extracted invoices
def find_missing_invoices(summary_df, invoices_df) -> pd.DataFrame:
    summary_ids = normalize_id_column(summary_df["invoice_id"])
    invoice_ids = normalize_id_column(invoices_df["invoice_id"])
    unmatched_mask = ~invoice_ids.apply(lambda inv_id: fuzzy_id_match(inv_id, summary_ids))
    return invoices_df[unmatched_mask].copy()


# Function to find missing proofs in the summary compared to extracted proofs
def find_missing_proofs(summary_df, proofs_df) -> pd.DataFrame:
    cheques = (summary_df["cheque_number"].astype(str)
               .str.split(',').explode().str.strip())
    summary_ids = normalize_id_column(cheques)
    proof_ids = normalize_id_column(proofs_df["proof_id"])
    unmatched_mask = ~proof_ids.apply(lambda pid: fuzzy_id_match(pid, summary_ids))
    return proofs_df[unmatched_mask].copy()
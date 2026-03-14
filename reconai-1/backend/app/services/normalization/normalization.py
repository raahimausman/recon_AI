# libraries imports
import sys
import pandas as pd
import json
from dateutil import parser
from langchain_core.messages import HumanMessage

# local imports
from ...config import llm   
from ..utils.prompt_builder import build_column_mapping_prompt
from ..utils.data_loading import load_extracted_data


BASE_OUTPUT_DIR = "output/normalization"


# Utility function to safely parse dates
def safe_parse_date(date_str):
    """
    Attempts to parse any date string into ISO YYYY-MM-DD.
    Tries multiple strategies to reduce parsing failures.
    """
    if pd.isnull(date_str):
        return None
    date_str = str(date_str).strip()
    if not date_str or date_str.lower() in ['nan', 'none']:
        return None
    
    # Try default parse
    try:
        return parser.parse(date_str, fuzzy=True).date().isoformat()
    except Exception:
        pass

    # Try dayfirst
    try:
        return parser.parse(date_str, fuzzy=True, dayfirst=True).date().isoformat()
    except Exception:
        pass

    # Could not parse
    return None


def standardize_summary_columns_with_llm(summary_df: pd.DataFrame) -> pd.DataFrame:
    """
    Uses Azure OpenAI to map messy summary_of_invoices columns
    to the 5 standard canonical field names.
    
    Standard fields:
    - invoice_id
    - vendor_name
    - date
    - invoice_total
    - cheque_number
    
    Columns not mapped are dropped.
    Missing standard columns are added with None.
    """
    
    # Extract raw column names
    raw_columns = list(summary_df.columns)
    print(f"Original columns found: {raw_columns}")
    
    # Build the prompt
    prompt_text = build_column_mapping_prompt(raw_columns)
    
    # Call the LLM
    message = HumanMessage(content=prompt_text)
    print("Sending column names to LLM for mapping...")
    response = llm.invoke([message])
    mapping_json = response.content.strip()
    
    # Parse returned JSON
    try:
        column_mapping = json.loads(mapping_json)
    except json.JSONDecodeError:
        raise ValueError("LLM response could not be parsed as JSON. Check prompt and response formatting.")
    
    # Apply mapping: remove columns mapped to null
    renamed_columns = {}
    for original_col, target_col in column_mapping.items():
        if target_col is not None:
            renamed_columns[original_col] = target_col
    
    # Rename columns
    standardized_df = summary_df.rename(columns=renamed_columns)
    
    # Drop any columns not in the standard set
    standard_columns = ["invoice_id", "vendor_name", "date", "invoice_total", "cheque_number"]
    standardized_df = standardized_df[[col for col in standardized_df.columns if col in standard_columns]]
    
    # Add missing standard columns as None
    for col in standard_columns:
        if col not in standardized_df.columns:
            standardized_df[col] = None
    
    # Reorder columns
    standardized_df = standardized_df[standard_columns]

    print(f"Standardized columns: {standardized_df.columns.tolist()}")
    
    return standardized_df


def normalize_summary_values(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans and normalizes a standardized summary_of_invoices DataFrame:
    - Trims whitespace
    - Standardizes casing
    - Parses amounts to numeric
    - Parses dates to YYYY-MM-DD format
    - Drops rows with insufficient data
    """

    df = df.copy()

    # Normalize invoice_id and cheque_number: trim and uppercase
    for col in ['invoice_id', 'cheque_number']:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.upper()
            df[col] = df[col].replace({"": None, "nan": None, "NaN": None})


    # Normalize vendor_name: trim and title case
    if 'vendor_name' in df.columns:
        df['vendor_name'] = df['vendor_name'].astype(str).str.strip().str.title()
        df['vendor_name'] = df['vendor_name'].replace({"": None, "nan": None, "NaN": None})

    # Normalize dates
    if 'date' in df.columns:
        df['date'] = df['date'].apply(safe_parse_date)

    # Normalize invoice_total: parse to float
    if 'invoice_total' in df.columns:
        df['invoice_total'] = (
            df['invoice_total']
            .astype(str)
            .str.replace(r"[^0-9.\-]", "", regex=True)
            .replace({"": None, "nan": None, "NaN": None})
        )
        df['invoice_total'] = pd.to_numeric(df['invoice_total'], errors='coerce')

    # Drop rows with insufficient data
    # For example, require BOTH invoice_id and invoice_total to be present
    df = df.dropna(subset=['invoice_id', 'invoice_total'], how='any')

    # Reset index
    df = df.reset_index(drop=True)

    # Drop rows where invoice_id is NaN or 'NAN'
    df = df[df['invoice_id'].notna() & (df['invoice_id'].astype(str).str.upper() != 'NAN')].copy()

    print(f"Normalized summary DataFrame with {len(df)} rows and columns: {df.columns.tolist()}")

    return df


def normalize_extracted_invoices(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalizes extracted_invoices DataFrame:
    - Trims whitespace
    - Standardizes casing
    - Parses dates to YYYY-MM-DD
    - Parses amounts to numeric
    """
    df = df.copy()

    # Normalize invoice_id: trim and uppercase
    if 'invoice_id' in df.columns:
        df['invoice_id'] = df['invoice_id'].astype(str).str.strip().str.upper()
        df['invoice_id'] = df['invoice_id'].replace({"": None, "nan": None, "NaN": None})

    # Normalize vendor_name: trim and title case
    if 'vendor_name' in df.columns:
        df['vendor_name'] = df['vendor_name'].astype(str).str.strip().str.title()
        df['vendor_name'] = df['vendor_name'].replace({"": None, "nan": None, "NaN": None})

    # Normalize dates
    if 'date' in df.columns:
        df['date'] = df['date'].apply(safe_parse_date)

    # Normalize total_amount
    if 'total_amount' in df.columns:
        df['total_amount'] = (
            df['total_amount']
            .astype(str)
            .str.replace(r"[^0-9.\-]", "", regex=True)
            .replace({"": None, "nan": None, "NaN": None})
        )
        df['total_amount'] = pd.to_numeric(df['total_amount'], errors='coerce')

    # Drop rows missing invoice_id or total_amount
    df = df.dropna(subset=['invoice_id', 'total_amount'], how='any')
    df = df.reset_index(drop=True)

    print(f"Normalized invoices DataFrame with {len(df)} rows and columns: {df.columns.tolist()}")

    return df


def normalize_extracted_proofs(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalizes extracted_proofs DataFrame:
    - Trims whitespace
    - Standardizes casing
    - Parses dates to YYYY-MM-DD
    - Parses amounts to numeric
    """
    df = df.copy()

    # Normalize proof_type
    if 'proof_type' in df.columns:
        df['proof_type'] = df['proof_type'].astype(str).str.strip().str.lower()
        df['proof_type'] = df['proof_type'].replace({"": None, "nan": None, "NaN": None})

    # Normalize proof_id
    if 'proof_id' in df.columns:
        df['proof_id'] = df['proof_id'].astype(str).str.strip().str.upper()
        df['proof_id'] = df['proof_id'].replace({"": None, "nan": None, "NaN": None})

    # Normalize party_name and bank_name
    for col in ['party_name', 'bank_name']:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.title()
            df[col] = df[col].replace({"": None, "nan": None, "NaN": None})

    # Normalize amount_words: just strip
    if 'amount_words' in df.columns:
        df['amount_words'] = df['amount_words'].astype(str).str.strip()
        df['amount_words'] = df['amount_words'].replace({"": None, "nan": None, "NaN": None})

    # Normalize dates
    if 'date' in df.columns:
        df['date'] = df['date'].apply(safe_parse_date)

    # Normalize amount_numeric
    if 'amount_numeric' in df.columns:
        df['amount_numeric'] = (
            df['amount_numeric']
            .astype(str)
            .str.replace(r"[^0-9.\-]", "", regex=True)
            .replace({"": None, "nan": None, "NaN": None})
        )
        df['amount_numeric'] = pd.to_numeric(df['amount_numeric'], errors='coerce')

    # Drop rows missing proof_id or amount_numeric
    df = df.dropna(subset=['proof_id', 'amount_numeric'], how='any')
    df = df.reset_index(drop=True)

    print(f"Normalized proofs DataFrame with {len(df)} rows and columns: {df.columns.tolist()}")

    return df
#POS AND GRNS

def pg_safe_parse_date(date_str):
    if pd.isnull(date_str):
        return None
    try:
        return parser.parse(str(date_str), fuzzy=True).date().isoformat()
    except:
        return None

def normalize_po(df: pd.DataFrame) -> pd.DataFrame:
    """
    Input columns: po_number (str), vendor_name (str), date (str), total_amount (float).
    Output: cleaned DataFrame ready for matching.
    """
    df = df.copy()

    # PO number: trim & uppercase
    # df['po_number'] = df['po_number'].astype(str).str.strip().str.upper().replace({'': None, 'NAN': None})

    # Vendor: trim & title case
    df['vendor_name'] = df['vendor_name'].astype(str).str.strip().str.title().replace({'': None, 'Nan': None})

    # Date
    df['date'] = df['date'].apply(pg_safe_parse_date)

    # total_amount is already a float—just ensure numeric and drop NaN
    df = df[pd.to_numeric(df['total_amount'], errors='coerce').notna()].copy()

    # Reset index
    return df.reset_index(drop=True)

def normalize_grn(df: pd.DataFrame) -> pd.DataFrame:
    """
    Input columns: grn_number, vendor_name, po_number, date, total_amount.
    """
    df = df.copy()
    # df['po_number']   = df['po_number'].astype(str).str.strip().str.upper().replace({'': None})
    df['vendor_name'] = df['vendor_name'].astype(str).str.strip().str.title().replace({'': None})
    df['date']        = df['date'].apply(safe_parse_date)

    # Keep only rows where total_amount is a real number
    df = df[pd.to_numeric(df['total_amount'], errors='coerce').notna()].copy()

    return df.reset_index(drop=True)

if __name__ == "__main__":  
    if len(sys.argv) != 2:
        print("Usage: python normalization.py <package_name>")
        sys.exit(1)
    package_name = sys.argv[1]

    summary_df, invoices_df, proofs_df = load_extracted_data(package_name)

    standardized_summary_df = standardize_summary_columns_with_llm(summary_df)
    normalized_summary_df = normalize_summary_values(standardized_summary_df)
    normalized_summary_df.to_excel(f"{BASE_OUTPUT_DIR}/{package_name}_standardized_summary.xlsx", index=False)

    normalized_invoices_df = normalize_extracted_invoices(invoices_df)
    normalized_invoices_df.to_excel(f"{BASE_OUTPUT_DIR}/{package_name}_normalized_invoices.xlsx", index=False)

    normalized_proofs_df = normalize_extracted_proofs(proofs_df)
    normalized_proofs_df.to_excel(f"{BASE_OUTPUT_DIR}/{package_name}_normalized_proofs.xlsx", index=False)
"""
Three-way matching for invoice reconciliation using LLMs 
between invoices, proofs of payment, and summary of invoices.
"""


# libraries imports
import sys
import pandas as pd
from pathlib import Path

# local imports
from ...config import llm
from ..utils.data_loading import load_normalized_data
from ..utils.id_utils import normalize_id_column, drop_invalid_invoices, llm_vendor_match_check


MODULE_DIR = Path(__file__).resolve().parent.parent.parent    
BASE_OUTPUT_DIR = MODULE_DIR / "output" / "three_way_reconciliation"
BASE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# Build a link table for invoice-cheque relationships
def build_link_table(summary_df):
    """
    Explode multiple cheque_numbers per invoice into separate rows.
    Returns dataframe with columns: invoice_id, cheque_number, invoice_total
    """
    df = summary_df.copy()

    # Normalize cheque_number
    df['cheque_number'] = df['cheque_number'].astype(str)
    df = df.assign(cheque_number=df['cheque_number'].str.split(',')).explode('cheque_number')
    df['cheque_number'] = df['cheque_number'].str.strip()
    df = df[df['cheque_number'] != '']
    df['cheque_number'] = normalize_id_column(df['cheque_number'])

    # Select relevant columns
    df = df[['invoice_id', 'invoice_total', 'cheque_number', 'vendor_name']]

    print(f"Built link table with {len(df)} rows.")
    return df


# Validate vendor similarity and cheque splits
def validate_vendor_similarity(link_df, proofs_df):
    """
    For each invoice-cheque link:
    - Merges vendor_name (from summary) and party_name (from proofs).
    - Computes fuzzy similarity score.
    - Flags vendor_match based on threshold.
    - Adds a human-readable status.
    Returns:
        vendor_report DataFrame
    """
    
    link_df['cheque_number'] = normalize_id_column(link_df['cheque_number'])
    proofs_df['proof_id'] = normalize_id_column(proofs_df['proof_id'])

    # Merge to get party_name from proofs
    vendor_report = pd.merge(
        link_df,
        proofs_df[['proof_id', 'party_name']],
        left_on='cheque_number',
        right_on='proof_id',
        how='left'
    )

    # Check vendor match using LLM
    vendor_report['vendor_match'] = vendor_report.apply(
    lambda row: llm_vendor_match_check(llm, row['vendor_name'], row['party_name']),
    axis=1
    )

    # Add readable status
    vendor_report['vendor_status'] = vendor_report['vendor_match'].apply(
        lambda x: "Vendor Matched" if x else "Vendor Mismatch"
    )

    print(f"Validated vendor similarity for {len(vendor_report)} invoice-cheque links.")
    return vendor_report[['invoice_id', 'cheque_number', 'vendor_match', 'vendor_status']]


# Validate cheque splits and allocate amounts
def validate_cheque_splits(link_df, proofs_df):
    """
    For each cheque_number/proof_id:
    - Sums all invoice_total linked.
    - Compares to cheque amount_numeric.
    - Flags Fully Applied / Over/Under Applied.
    Returns a dataframe of cheque statuses.
    """
    link_sum = link_df.groupby('cheque_number')['invoice_total'].sum().reset_index()
    link_sum.rename(columns={'cheque_number': 'proof_id', 'invoice_total': 'sum_linked_invoices'}, inplace=True)

    proofs_df = proofs_df.copy()
    proofs_df['proof_id'] = normalize_id_column(proofs_df['proof_id'])

    cheque_report = pd.merge(
        proofs_df,
        link_sum,
        on='proof_id',
        how='left'
    )

    cheque_report['sum_linked_invoices'] = cheque_report['sum_linked_invoices'].fillna(0)

    cheque_report['amount_match'] = (
        (cheque_report['amount_numeric'] - cheque_report['sum_linked_invoices']).abs() < 0.01
    )

    def determine_status(row):
        if row['sum_linked_invoices'] == 0:
            return "Unused Cheque"
        if not row['amount_match']:
            return "Over/Under Applied"
        return "Fully Applied"

    cheque_report['status'] = cheque_report.apply(determine_status, axis=1)
    print(f"Validated cheque splits across invoices.")
    return cheque_report


# Merge proofs with summary and validate amounts and vendors
def assign_cheque_status_to_invoices(link_df, cheque_report, vendor_report):
    """
    Merge cheque status back onto link_df to assign invoice payment status.
    """
    link_df = link_df.copy()
    link_df['cheque_number'] = normalize_id_column(link_df['cheque_number'])
    cheque_report['proof_id'] = normalize_id_column(cheque_report['proof_id'])

    merged = pd.merge(
        link_df,
        cheque_report[['proof_id', 'status']],
        left_on='cheque_number',
        right_on='proof_id',
        how='left'
    )

    merged = pd.merge(
    merged,
    vendor_report,
    on=['invoice_id', 'cheque_number'],
    how='left'
    )

    merged.drop(columns=['proof_id'], inplace=True)
    merged.rename(columns={'status': 'invoice_payment_status'}, inplace=True)
   
    print("Assigned cheque payment status back to invoice links.")
    return merged


# Allocate proof amounts proportionally to linked invoices
def allocate_proof_amounts(merged_links, cheque_report):
    """
    Allocates cheque amount_numeric proportionally to linked invoices.
    """
    # Merge total invoice sums for each cheque
    sum_invoice_totals = merged_links.groupby('cheque_number')['invoice_total'].sum().reset_index()
    sum_invoice_totals.rename(columns={'invoice_total': 'total_linked_invoices'}, inplace=True)

    # Normalize ID and amount columns
    merged_links['cheque_number'] = normalize_id_column(merged_links['cheque_number'])
    sum_invoice_totals['cheque_number'] = normalize_id_column(sum_invoice_totals['cheque_number'])
    cheque_report['proof_id'] = normalize_id_column(cheque_report['proof_id'])

    merged = pd.merge(merged_links, sum_invoice_totals, on='cheque_number', how='left')
    merged = pd.merge(merged, cheque_report[['proof_id', 'amount_numeric']], 
                       left_on='cheque_number', right_on='proof_id', how='left')

    merged['proof_amount'] = (
        merged['invoice_total'] / merged['total_linked_invoices'] * merged['amount_numeric']
    ).fillna(0)

    print("Allocated proof amounts proportionally to linked invoices.")
    return merged


# Reconcile invoices by aggregating linked cheques and validating amounts
def reconcile_invoices(merged_links):
    """
    For each invoice:
    - Collect all matched cheques.
    - Sum of matched proof amounts.
    - Aggregates vendor match flag.
    - Combines amount and vendor validation into issues column.
    """

    # Aggregate at invoice level
    agg = merged_links.groupby('invoice_id').agg({
        'invoice_total': 'first',
        'cheque_number': lambda x: ','.join(x.dropna().unique()),
        'proof_amount': 'sum',
        'invoice_payment_status': lambda x: (
            "Matched" if (x == "Fully Applied").all() else "Amount Mismatch"
        ),
        'vendor_match': 'all'
    }).reset_index()

    # Rename columns for output clarity
    agg.rename(columns={
        'cheque_number': 'matched_cheques',
        'proof_amount': 'sum_proof_amounts',
        'invoice_payment_status': 'issues'
    }, inplace=True)

    # Amount match flag
    agg['amount_match'] = (agg['issues'] == "Matched")


    # Determine final combined issues
    def determine_issues(row):
        # If no actual proof amount was allocated
        if row['sum_proof_amounts'] == 0 or pd.isna(row['sum_proof_amounts']):
            return "Missing Proof"
        
        # Else evaluate amount and vendor match
        if row['amount_match'] and row['vendor_match']:
            return "Matched"

        issues = []
        if not row['amount_match']:
            issues.append("Amount Mismatch")
        if not row['vendor_match']:
            issues.append("Vendor Mismatch")
        return "; ".join(issues)

    agg['issues'] = agg.apply(determine_issues, axis=1)

    # Drop invalid invoices (missing IDs or totals)
    agg = drop_invalid_invoices(agg)

    print(f"Built final invoice reconciliation report.")
    return agg


# Build a report of cheque utilization across invoices
def build_cheque_utilization_report(link_df, proofs_df):
    """
    Checks how cheques were used across invoices.
    For each proof_id, shows amount and sum of linked invoice totals.
    """
    link_sum = link_df.groupby('cheque_number')['invoice_total'].sum().reset_index()
    link_sum.rename(columns={'cheque_number': 'proof_id', 'invoice_total': 'sum_linked_invoices'}, inplace=True)

    proofs_df = proofs_df.copy()
    proofs_df['proof_id'] = proofs_df['proof_id'].astype(str).str.strip()
    proofs_df = proofs_df[proofs_df['proof_id'] != '']
    proofs_df['proof_id'] = normalize_id_column(proofs_df['proof_id'])

    cheque_report = pd.merge(
        proofs_df,
        link_sum,
        on='proof_id',
        how='left'
    )

    cheque_report['sum_linked_invoices'] = cheque_report['sum_linked_invoices'].fillna(0)

    cheque_report['amount_match'] = (
        (cheque_report['amount_numeric'] - cheque_report['sum_linked_invoices']).abs() < 0.01
    )

    def determine_status(row):
        if row['sum_linked_invoices'] == 0:
            return "Unused Cheque"
        if not row['amount_match']:
            return "Over/Under Applied"
        return "Fully Applied"

    cheque_report['status'] = cheque_report.apply(determine_status, axis=1)

    print(f"Generated cheque utilization report for {len(cheque_report)} proofs.")
    return cheque_report


def run_reconciliation(summary_df, proofs_df, package_name):
    print("\n Reconciliation Start \n")
    
    link_df = build_link_table(summary_df)

    cheque_report = validate_cheque_splits(link_df, proofs_df)
    vendor_report = validate_vendor_similarity(link_df, proofs_df)
    merged_links = assign_cheque_status_to_invoices(link_df, cheque_report, vendor_report)
    
    allocated_links = allocate_proof_amounts(merged_links, cheque_report)
    invoice_report = reconcile_invoices(allocated_links)

    # Save results
    invoice_output = f"{BASE_OUTPUT_DIR}/{package_name}_invoice_reconciliation_report.xlsx"
    cheque_output = f"{BASE_OUTPUT_DIR}/{package_name}_cheque_utilization_report.xlsx"

    invoice_report.to_excel(invoice_output, index=False)
    cheque_report.to_excel(cheque_output, index=False)

    print(f"\nInvoice reconciliation saved to: {invoice_output}")
    print(f"Cheque utilization report saved to: {cheque_output}")
    print("\n Reconciliation Complete \n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python matching.py <package_name>")
        sys.exit(1)

    package_name = sys.argv[1]
    try:
        summary_df, invoices_df, proofs_df = load_normalized_data(package_name)
        run_reconciliation(summary_df, proofs_df, package_name)
    except Exception as e:
        print(f"Error during reconciliation: {e}")
        sys.exit(1)
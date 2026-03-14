# libraries imports
import pandas as pd
from pathlib import Path


MODULE_DIR = Path(__file__).resolve().parent.parent.parent
print(f"Module directory: {MODULE_DIR}")


# Function to load reconciliation data from Excel files
def load_extracted_data(package_name, base_output_dir=Path(MODULE_DIR / "output" / "extraction")):
    summary_path = f"{package_name}/summary_of_invoices.xlsx"
    invoices_path = f"{base_output_dir}/{package_name}_invoices_output.xlsx"
    proofs_path = f"{base_output_dir}/{package_name}_proofs_output.xlsx"

    print(f"Loading summary from: {summary_path}")
    summary_df = pd.read_excel(summary_path)

    print(f"Loading extracted invoices from: {invoices_path}")
    invoices_df = pd.read_excel(invoices_path)

    print(f"Loading extracted proofs from: {proofs_path}")
    proofs_df = pd.read_excel(proofs_path)

    return summary_df, invoices_df, proofs_df


# Function to load normalized data from Excel files
def load_normalized_data(package_name, base_output_dir=Path(MODULE_DIR / "output" / "normalization")):
    """
    Loads the normalized summary, extracted invoices, and proofs data.
    Returns them as three pandas DataFrames.
    Raises clear error if any file is missing.
    """

    summary_file = base_output_dir / f"{package_name}_standardized_summary.xlsx"
    invoices_file = base_output_dir / f"{package_name}_normalized_invoices.xlsx"
    proofs_file = base_output_dir / f"{package_name}_normalized_proofs.xlsx"

    # Check that all files exist
    missing_files = []
    for path in [summary_file, invoices_file, proofs_file]:
        if not path.exists():
            missing_files.append(str(path))

    if missing_files:
        raise FileNotFoundError(
            f"The following required files were not found:\n" +
            "\n".join(missing_files)
        )

    # Load each into DataFrame
    print(f"Loading summary file: {summary_file}")
    summary_df = pd.read_excel(summary_file)
    summary_df['date'] = pd.to_datetime(summary_df['date'], errors='coerce')

    print(f"Loading extracted invoices file: {invoices_file}")
    invoices_df = pd.read_excel(invoices_file)
    invoices_df['date'] = pd.to_datetime(invoices_df['date'], errors='coerce')

    print(f"Loading extracted proofs file: {proofs_file}")
    proofs_df = pd.read_excel(proofs_file)
    proofs_df['date'] = pd.to_datetime(proofs_df['date'], errors='coerce')

    print("All files loaded successfully.")
    return summary_df, invoices_df, proofs_df
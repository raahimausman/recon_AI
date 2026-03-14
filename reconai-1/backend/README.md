# Recon-AI Backend

## Overview
This backend powers document extraction, normalization, and reconciliation for invoices, proofs, summaries, POs, and GRNs using LLMs and vision models.

## Structure
- `app/`  
  - `api/` – FastAPI endpoints  
  - `services/` – Extraction, normalization, reconciliation logic  
  - `data/` – Input files (invoices, proofs, POs, GRNs)  
  - `output/` – Generated reports  
- `requirements.txt` – Python dependencies  
- `Dockerfile` – Container setup  
- `Makefile` – Dev commands

## Usage
1. Install dependencies:
   ```
   pip install --no-deps -r requirements.txt
   ```
2. Run the API server:
   ```
   uvicorn app.api.main:app --reload
   ```
3. Place input files in `app/data/` and access results in `app/output/`.

## Key Features
- Vision-based document parsing
- LLM-powered field extraction & normalization
- Automated reconciliation reports

## Testing
Run unit tests from the `tests/` folder.

## Contact
For issues, contact the Recon
# ReconAI

ReconAI is an AI-powered financial reconciliation system that automates document analysis and matching between invoices, purchase orders (PO), goods receipt notes (GRN), and proof documents. It uses a Next.js frontend and a Python backend API to classify documents and perform automated reconciliation.

## Features

* AI-based document classification
* Invoice and proof document summarization
* Two-way reconciliation
* Three-way reconciliation (Invoice, PO, GRN)
* Financial insights generation
* REST API for processing documents

## Tech Stack

**Frontend**

* Next.js
* TypeScript
* Node.js

**Backend**

* Python
* FastAPI (REST API)
* Docker support

## Project Structure

```
reconai
│
├── frontend     # Next.js web application
└── backend      # Python API and reconciliation services
```

## Installation

### 1. Clone the repository

```
git clone <repo-url>
cd reconai
```

### 2. Backend Setup

```
cd backend
pip install -r requirements.txt
python -m app.api.main
```

### 3. Frontend Setup

```
cd frontend
npm install
npm run dev
```

The frontend will run at:

```
http://localhost:3000
```

## Future Improvements

* OCR for scanned financial documents
* Improved AI models
* Dashboard analytics
* Role-based authentication
* Cloud deployment

## License

For educational and research purposes.

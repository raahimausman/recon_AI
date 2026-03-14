'use client';

import { useState } from 'react';
import { parseThreeWayInvoiceExcel, generateThreeWayInvoiceReport } from '@/lib/report-generation/generateThreeWayInvoiceReport';
import { parseChequeUtilizationExcel, generateChequeUtilizationReport } from '@/lib/report-generation/generateChequeUtilizationReport';
import { parseInvoiceSummaryExcel, generateInvoiceSummaryReport } from '@/lib/report-generation/generateInvoiceSummaryReport';
import { parseProofSummaryExcel, generateProofSummaryReport } from '@/lib/report-generation/generateProofSummaryReport';

export default function TestReportPage() {
  const [loading, setLoading] = useState(false);

  const handleThreeWay = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLoading(true);
      const data = await parseThreeWayInvoiceExcel(e.target.files[0]);
      generateThreeWayInvoiceReport(data);
      setLoading(false);
    }
  };

  const handleCheque = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLoading(true);
      const data = await parseChequeUtilizationExcel(e.target.files[0]);
      generateChequeUtilizationReport(data);
      setLoading(false);
    }
  };

    const handleInvoiceSummary = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
        setLoading(true);
        const data = await parseInvoiceSummaryExcel(e.target.files[0]);
        generateInvoiceSummaryReport(data);
        setLoading(false);
        }
    };

    const handleProofSummary = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLoading(true);
            const data = await parseProofSummaryExcel(e.target.files[0]);
            generateProofSummaryReport(data);
            setLoading(false);
        }
    };

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold mb-6">ReconAI Report Generator</h1>

      <div className="mb-8">
        <label className="block mb-2 font-medium">Upload Three-Way Invoice Reconciliation XLSX:</label>
        <input type="file" accept=".xlsx" className='cursor-pointer border border-black rounded-md p-2' onChange={handleThreeWay} />
      </div>

      <div className="mb-8">
        <label className="block mb-2 font-medium">Upload Cheque Utilization XLSX:</label>
        <input type="file" accept=".xlsx" className='cursor-pointer border border-black rounded-md p-2' onChange={handleCheque} />
      </div>

      <div className="mb-8">
        <label className="block mb-2 font-medium">Upload Invoice Summary XLSX:</label>
        <input type="file" accept=".xlsx" className='cursor-pointer border border-black rounded-md p-2' onChange={handleInvoiceSummary} />
      </div>

        <div className="mb-8">
            <label className="block mb-2 font-medium">Upload Proof Summary XLSX:</label>
            <input type="file" accept=".xlsx" className='cursor-pointer border border-black rounded-md p-2' onChange={handleProofSummary} />    
        </div>

      {loading && <p className="text-gray-600">Generating PDF Report...</p>}
    </div>
  );
}
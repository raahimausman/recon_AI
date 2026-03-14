import axios from 'axios';
import type { ReconModeId } from './endpoints';
import { RECON_ENDPOINTS } from './endpoints';
import { buildFormData } from './buildFormData';
import type { SourceType } from '@/types/source';

/**
 * Kicks off reconciliation, returns { blob, filename } once FastAPI responds.
 *
 * @param modeId   one of four IDs
 * @param files    validatedFiles map from the wizard
 */
export async function runReconciliation(
  modeId: ReconModeId,
  files: Record<SourceType, File[]>
): Promise<{ blob: Blob; filename: string }> {
  const meta = RECON_ENDPOINTS[modeId];
  if (!meta) throw new Error(`Unknown reconciliation mode: ${modeId}`);

  const form = buildFormData(files, meta.fieldMap);

  const url = `http://127.0.0.1:8000${meta.url}`;

  const resp = await axios.post<Blob>(url, form, {
    responseType: 'blob',
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  // nice filename
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fnBase =
    modeId === 'threeWay'
      ? 'Three-Way-Recon'
      : modeId === 'twoWayInvoiceSummary'
      ? 'Inv-Sum-Recon'
      : modeId === 'twoWayProofSummary'
      ? 'Proof-Sum-Recon'
      : 'PO-GRN-Recon';

  return {
    blob: resp.data,                // resp.data is Blob thanks to generic
    filename: `${fnBase}_${ts}.${meta.responseExt}`,
  };
}
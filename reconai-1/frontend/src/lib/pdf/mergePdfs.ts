import { PDFDocument } from 'pdf-lib';

/** Merge N PDF blobs into ONE valid PDF blob */
export async function mergePdfBlobs(blobs: Blob[]): Promise<Blob> {
  const out = await PDFDocument.create();

  for (const blob of blobs) {
    const bytes   = new Uint8Array(await blob.arrayBuffer());
    const srcDoc  = await PDFDocument.load(bytes);
    const pages   = await out.copyPages(srcDoc, srcDoc.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }

  const mergedBytes = await out.save();
  return new Blob([mergedBytes], { type: 'application/pdf' });
}
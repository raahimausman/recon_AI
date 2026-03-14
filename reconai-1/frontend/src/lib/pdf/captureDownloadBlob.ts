// somewhere early (e.g. in lib/pdf/captureDownloadBlob.ts)
import pdfMake from 'pdfmake/build/pdfmake';

// helper that returns a Blob **once** and then restores default behaviour
export async function captureNextPdfDownload(): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const orig = pdfMake.createPdf as any;

    // wrap the factory
    pdfMake.createPdf = function (...args: any[]) {
      const pdf = orig.apply(this, args);

      // monkey-patch *download* on this single PdfDoc instance
      const origDownload = pdf.download;
      pdf.download = function (_filename: string) {
        pdf.getBlob((blob: Blob) => {
          // restore
          pdfMake.createPdf = orig;
          resolve(blob);
        });
      };

      return pdf;
    };
  });
}
// utils/uploadToCloudinary.ts  (OVERWRITE the file)

const CLOUD   = process.env.NEXT_PUBLIC_CLOUD_NAME!;
const PRESET  = process.env.NEXT_PUBLIC_CLOUD_PRESET!;      // unsigned

/** upload the final PDF – returns the secure url, #pages and publicId */
export async function uploadPdfToCloudinary(
  pdf: Blob,
  publicId: string,                // reconciliations/<runId>/report
) {
  const form = new FormData();
  form.append('file', pdf);
  form.append('upload_preset', PRESET);
  form.append('public_id',      publicId);      // no extension
  form.append('resource_type',  'raw');         // <— IMPORTANT

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/raw/upload`,
    { method: 'POST', body: form },
  );

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error?.message ?? 'Cloudinary upload failed');
  }

  // pages = number of pages in the PDF
  const { secure_url, pages, public_id } = await res.json();
  return { pdfUrl: secure_url as string, pages: pages as number, publicId: public_id as string };
}

/** build https URLs for every page as PNG */
export function buildPageUrls(publicId: string, pages: number): string[] {
  const base = `https://res.cloudinary.com/${CLOUD}/image/upload`;
  return Array.from({ length: pages }, (_, i) =>
    `${base}/pg_${i + 1}/f_png/${publicId}.png`
  );
}

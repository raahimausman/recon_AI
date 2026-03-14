/**
 * Extract a human-friendly file name from a Cloudinary delivery URL.
 * Works for both “raw” and “image/…/pdf” resources, with or without an
 * explicit extension in the public-id.
 *
 * Examples
 *  ├─ .../raw/upload/v123456/reports/inv_sum_2025-07-20/report      → inv_sum_2025-07-20.pdf
 *  ├─ .../raw/upload/v123456/reports/demo-file.pdf                  → demo-file.pdf
 *  └─ .../image/upload/v123456/reports/foo_bar                      → foo_bar.pdf
 */
export function getFileName(url: string, fallback = 'report.pdf'): string {
  try {
    // strip any query-string
    const clean = url.split('?')[0];

    // split after “…/upload/<type-or-version>/”
    // regex keeps everything *after* the version segment
    const match = clean.match(/\/upload\/(?:[^/]+\/)?v?\d+\/(.+)$/);
    if (!match) return fallback;

    const publicId = decodeURIComponent(match[1]);              // reports/myFolder/report
    const segments = publicId.split('/');

    // if the last segment is a generic “report”, pick the one before it
    let base = segments.pop() || '';
    if (base === 'report' && segments.length) base = segments.pop()!;

    // ensure .pdf extension (Cloudinary raw resources have none)
    return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
  } catch {
    return fallback;
  }
}

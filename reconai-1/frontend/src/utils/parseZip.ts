import JSZip from 'jszip';

interface ParsedPackage {
  invoices: File[];
  proofs: File[];
  summary: File | null;
}

interface PackageValidation {
  valid: boolean;
  errors?: string[];
}

interface PackagePreview {
  parsedPackage: ParsedPackage;
  validation: PackageValidation;
}


export async function parseZip(file: File): Promise<PackagePreview> {
  const zip = await JSZip.loadAsync(file);

  const allPaths: string[] = [];
  zip.forEach((relativePath) => {
    allPaths.push(relativePath);
  });

  // Find common prefix
  const getCommonPrefix = (paths: string[]): string => {
    if (paths.length === 0) return '';
    const splitPaths = paths.map(p => p.split('/'));
    let prefixParts = [];
    for (let i = 0; ; i++) {
      const part = splitPaths[0][i];
      if (!part) break;
      if (splitPaths.every(path => path[i] === part)) {
        prefixParts.push(part);
      } else {
        break;
      }
    }
    return prefixParts.length > 0 ? prefixParts.join('/') + '/' : '';
  };

  const commonPrefix = getCommonPrefix(allPaths);

  const invoices: File[] = [];
  const proofs: File[] = [];
  let summary: File | null = null;
  const summaryCandidates: File[] = [];
  const filePromises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    const normalizedPath = relativePath.startsWith(commonPrefix)
      ? relativePath.slice(commonPrefix.length)
      : relativePath;

    filePromises.push(
      zipEntry.async('blob').then((blob) => {
        if (normalizedPath.startsWith('invoices/') && zipEntry.name.toLowerCase().endsWith('.pdf')) {
          invoices.push(new File([blob], zipEntry.name));
        }
        else if (normalizedPath.startsWith('proof_of_payments/') && zipEntry.name.toLowerCase().endsWith('.pdf')) {
          proofs.push(new File([blob], zipEntry.name));
        }
        else if (zipEntry.name.toLowerCase().endsWith('.xlsx') && !normalizedPath.includes('/')) {
          summaryCandidates.push(new File([blob], zipEntry.name));
        }
      })
    );
  });

  await Promise.all(filePromises);

  if (summaryCandidates.length > 0) {
    summary = summaryCandidates[0];
  }

  const errors: string[] = [];
  if (invoices.length === 0) errors.push('Missing invoices/ folder with PDF files.');
  if (proofs.length === 0) errors.push('Missing proof_of_payments/ folder with PDF files.');
  if (!summary) errors.push('Missing .xlsx summary file at the root level.');

  if (errors.length > 0) {
    return {
      parsedPackage: { invoices, proofs, summary },
      validation: { valid: false, errors },
    };
  }

  return {
    parsedPackage: { invoices, proofs, summary },
    validation: { valid: true },
  };
}

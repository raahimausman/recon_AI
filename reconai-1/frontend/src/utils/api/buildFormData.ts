import type { SourceType } from '@/types/source';

/**
 * Converts our {Invoice: File[], …} map into multipart FormData
 * based on the endpoint's fieldMap.
 */
export function buildFormData(
  fileMap: Record<SourceType, File[]>,
  fieldMap: Partial<Record<SourceType, string>>
): FormData {
  const fd = new FormData();

  Object.entries(fieldMap).forEach(([srcType, fieldName]) => {
    if (!fieldName) return; // should never happen, but stay defensive

    const files = fileMap[srcType as SourceType] ?? [];
    if (files.length === 0) return;  // nothing for that slot → skip

    const isSingleField = fieldName.endsWith('_file'); // convention
    if (isSingleField) {
      fd.append(fieldName, files[0], files[0].name);
    } else {
      files.forEach(f => fd.append(fieldName, f, f.name));
    }
  });

  return fd;
}
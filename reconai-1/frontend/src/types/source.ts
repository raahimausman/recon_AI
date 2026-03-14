export const OPTIONS = [
  'Invoice',
  'Proof of Payment',
  'Summary of Invoices',
  'Purchase Order',
  'Goods Receipt Note'
] as const;

export type SourceType = (typeof OPTIONS)[number];

export interface UploadedSource {
  type: SourceType;
  files: File[];
}

export interface ClassifiedFile {
  file: File;
  filename: string;
  detectedType: string;
  match: boolean;
}

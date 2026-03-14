// src/types/genericResult.ts
export type Cell = string | number | boolean | null;

export interface GenericReportMeta {
  modeLabel   : string;
  generatedOn : string;
  stats       : Record<string, number>;   // e.g. { total: 120, matched: 108, issues: 12 }
}

export interface GenericResult {
  meta : GenericReportMeta;
  rows : Record<string, Cell>[];          // one object per table-row
}
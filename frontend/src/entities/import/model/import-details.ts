import { ImportErrorSummaryItem } from "./import-error-summary-item";
import { ImportStatus } from "./import-status";

export type ImportDetails = {
  jobId: string;
  status: ImportStatus;
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  insertedCount: number;
  updatedCount: number;
  topErrors: ImportErrorSummaryItem[];
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
};

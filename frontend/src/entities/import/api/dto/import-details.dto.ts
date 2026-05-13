import type { ImportDetails } from "../../model";

export type ImportDetailsDto = {
  jobId: string;
  status: ImportDetails["status"];
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  insertedCount: number;
  updatedCount: number;
  topErrors: ImportDetails["topErrors"];
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
};

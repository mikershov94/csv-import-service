import { ImportStatus } from "./import-status";

export type ImportProgress = {
  jobId: string;
  status: ImportStatus;
  processedBytes: number;
  validRows: number;
  invalidRows: number;
};

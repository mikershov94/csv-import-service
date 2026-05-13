import type { ImportProgress } from "../../model";

export type ImportProgressEventDto = {
  jobId: string;
  status: ImportProgress["status"];
  processedBytes: number;
  validRows: number;
  invalidRows: number;
};

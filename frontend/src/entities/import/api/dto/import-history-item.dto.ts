import type { ImportHistoryItem } from "../../model";

export type ImportHistoryItemDto = {
  jobId: string;
  status: ImportHistoryItem["status"];
  fileName: string;
  fileSizeBytes: number;
  createdAt: string;
};

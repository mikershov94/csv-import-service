import { ImportStatus } from "./import-status";

export type ImportHistoryItem = {
  jobId: string;
  status: ImportStatus;
  fileName: string;
  fileSizeBytes: number;
  createdAt: string;
};

export type RecentImports = {
  items: ImportHistoryItem[];
};

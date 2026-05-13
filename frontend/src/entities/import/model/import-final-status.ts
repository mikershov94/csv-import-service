import { ImportStatus } from "./import-status";

const FINAL_IMPORT_STATUSES = new Set<ImportStatus>([
  ImportStatus.COMPLETED,
  ImportStatus.COMPLETED_WITH_ERRORS,
  ImportStatus.FAILED,
]);

export function isFinalImportStatus(status: ImportStatus): boolean {
  return FINAL_IMPORT_STATUSES.has(status);
}

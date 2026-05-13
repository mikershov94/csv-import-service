import { ImportErrorSummaryItem, ImportStatus } from '@shared';

export interface ImportProgressDelta {
    processedRows: number;
    successRows: number;
    failedRows: number;
    insertedCount: number;
    updatedCount: number;
    errorItems?: ImportErrorSummaryItem[];
}

export interface ImportCompletionResult {
    status: ImportStatus;
    finishedAt: Date;
}

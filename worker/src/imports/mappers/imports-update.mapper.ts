import { ImportStatus } from '@shared';

import { ImportProgressDelta } from '../interfaces/imports.interfaces';

export function mapMarkProcessingUpdate() {
    return {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
    };
}

export function mapProgressDeltaToIncUpdate(delta: ImportProgressDelta) {
    return {
        processedRows: delta.processedRows,
        successRows: delta.successRows,
        failedRows: delta.failedRows,
        insertedCount: delta.insertedCount,
        updatedCount: delta.updatedCount,
    };
}

import {
    IMPORT_QUEUE_EVENT_VERSION,
    IMPORT_QUEUE_EVENTS,
    ImportChunkEvent,
    ImportJobStartEvent,
    ImportStreamEndEvent,
} from '@shared';

export function buildImportJobStartEvent(
    jobId: string,
    fileName: string,
    fileSizeBytes: number,
): ImportJobStartEvent {
    return {
        version: IMPORT_QUEUE_EVENT_VERSION,
        type: IMPORT_QUEUE_EVENTS.JOB_START,
        jobId,
        fileName,
        fileSizeBytes,
    };
}

export function buildImportChunkEvent(
    jobId: string,
    chunkIndex: number,
    isLast: boolean,
    rows: string[],
): ImportChunkEvent {
    return {
        version: IMPORT_QUEUE_EVENT_VERSION,
        type: IMPORT_QUEUE_EVENTS.CHUNK,
        jobId,
        chunkIndex,
        isLast,
        rowsCount: rows.length,
        rows,
    };
}

export function buildImportStreamEndEvent(
    jobId: string,
    totalChunks: number,
    totalRows: number,
): ImportStreamEndEvent {
    return {
        version: IMPORT_QUEUE_EVENT_VERSION,
        type: IMPORT_QUEUE_EVENTS.STREAM_END,
        jobId,
        totalChunks,
        totalRows,
    };
}

import { IMPORT_QUEUE_EVENTS, IMPORT_QUEUE_EVENT_VERSION } from './import-queue.consts';

export interface ImportJobStartEvent {
    version: typeof IMPORT_QUEUE_EVENT_VERSION;
    type: typeof IMPORT_QUEUE_EVENTS.JOB_START;
    jobId: string;
    fileName: string;
    fileSizeBytes: number;
}

export interface ImportChunkEvent {
    version: typeof IMPORT_QUEUE_EVENT_VERSION;
    type: typeof IMPORT_QUEUE_EVENTS.CHUNK;
    jobId: string;
    chunkIndex: number;
    isLast: boolean;
    rowsCount: number;
    rows: string[];
}

export interface ImportStreamEndEvent {
    version: typeof IMPORT_QUEUE_EVENT_VERSION;
    type: typeof IMPORT_QUEUE_EVENTS.STREAM_END;
    jobId: string;
    totalChunks: number;
    totalRows: number;
}

export type ImportQueueEvent = ImportJobStartEvent | ImportChunkEvent | ImportStreamEndEvent;

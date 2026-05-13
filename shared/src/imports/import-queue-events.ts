export const IMPORT_QUEUE_EVENT_VERSION = 1;

export const IMPORT_QUEUE_EVENTS = {
    JOB_START: 'import.job.start',
    CHUNK: 'import.chunk',
    STREAM_END: 'import.stream.end',
} as const;

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
    rows: string[];
}

export interface ImportStreamEndEvent {
    version: typeof IMPORT_QUEUE_EVENT_VERSION;
    type: typeof IMPORT_QUEUE_EVENTS.STREAM_END;
    jobId: string;
    totalChunks: number;
}

export type ImportQueueEvent = ImportJobStartEvent | ImportChunkEvent | ImportStreamEndEvent;

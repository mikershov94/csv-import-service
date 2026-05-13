export const IMPORT_QUEUE_EVENT_VERSION = 1;

export const IMPORT_QUEUE_EVENTS = {
    JOB_START: 'import.job.start',
    CHUNK: 'import.chunk',
    STREAM_END: 'import.stream.end',
} as const;

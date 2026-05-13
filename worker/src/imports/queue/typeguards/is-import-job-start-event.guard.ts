import { IMPORT_QUEUE_EVENTS, ImportJobStartEvent } from '@shared';

import { isObject } from './is-object.guard';

export function isImportJobStartEvent(value: unknown): value is ImportJobStartEvent {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.type === IMPORT_QUEUE_EVENTS.JOB_START &&
        typeof value.jobId === 'string' &&
        typeof value.fileName === 'string' &&
        typeof value.fileSizeBytes === 'number'
    );
}

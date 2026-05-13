import { IMPORT_QUEUE_EVENTS, ImportStreamEndEvent } from '@shared';

import { isObject } from './is-object.guard';

export function isImportStreamEndEvent(value: unknown): value is ImportStreamEndEvent {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.type === IMPORT_QUEUE_EVENTS.STREAM_END &&
        typeof value.jobId === 'string' &&
        typeof value.totalChunks === 'number' &&
        typeof value.totalRows === 'number'
    );
}

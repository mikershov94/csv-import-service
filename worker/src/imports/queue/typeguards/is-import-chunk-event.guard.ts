import { IMPORT_QUEUE_EVENTS, ImportChunkEvent } from '@shared';

import { isObject } from './is-object.guard';

export function isImportChunkEvent(value: unknown): value is ImportChunkEvent {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.type === IMPORT_QUEUE_EVENTS.CHUNK &&
        typeof value.jobId === 'string' &&
        typeof value.chunkIndex === 'number' &&
        typeof value.isLast === 'boolean' &&
        typeof value.rowsCount === 'number' &&
        Array.isArray(value.rows)
    );
}

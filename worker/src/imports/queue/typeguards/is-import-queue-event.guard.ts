import { ImportQueueEvent } from '@shared';

import { isImportChunkEvent } from './is-import-chunk-event.guard';
import { isImportJobStartEvent } from './is-import-job-start-event.guard';
import { isImportStreamEndEvent } from './is-import-stream-end-event.guard';

export function isImportQueueEvent(value: unknown): value is ImportQueueEvent {
    return (
        isImportJobStartEvent(value) || isImportChunkEvent(value) || isImportStreamEndEvent(value)
    );
}

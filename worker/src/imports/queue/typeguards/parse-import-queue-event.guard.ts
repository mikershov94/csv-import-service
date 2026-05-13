import { ImportQueueEvent } from '@shared';

import { isImportQueueEvent } from './is-import-queue-event.guard';

function parseJsonToUnknown(rawPayload: string): unknown {
    // JSON.parse returns `any`; normalize to `unknown` at the boundary.
    return JSON.parse(rawPayload) as unknown;
}

export function parseImportQueueEvent(rawPayload: string): ImportQueueEvent {
    const payload = parseJsonToUnknown(rawPayload);
    if (!isImportQueueEvent(payload)) {
        throw new Error('Некорректный payload события очереди');
    }

    return payload;
}

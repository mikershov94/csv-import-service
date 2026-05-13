import { ImportQueueEvent } from '@shared';

import { isImportQueueEvent } from './is-import-queue-event.guard';

export class InvalidQueueEventPayloadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidQueueEventPayloadError';
    }
}

function parseJsonToUnknown(rawPayload: string): unknown {
    try {
        // JSON.parse returns `any`; normalize to `unknown` at the boundary.
        return JSON.parse(rawPayload) as unknown;
    } catch {
        throw new InvalidQueueEventPayloadError('Некорректный JSON payload события очереди');
    }
}

export function parseImportQueueEvent(rawPayload: string): ImportQueueEvent {
    const payload = parseJsonToUnknown(rawPayload);
    if (!isImportQueueEvent(payload)) {
        throw new InvalidQueueEventPayloadError('Некорректный payload события очереди');
    }

    return payload;
}

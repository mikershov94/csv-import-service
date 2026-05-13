export const IMPORT_QUEUE_NAME = 'imports.queue';

export const DEFAULT_QUEUE_PUBLISH_RETRIES = 3;
export const MIN_QUEUE_PUBLISH_RETRIES = 1;
export const MAX_QUEUE_PUBLISH_RETRIES = 10;

export const DEFAULT_QUEUE_PUBLISH_TIMEOUT_MS = 5000;
export const MIN_QUEUE_PUBLISH_TIMEOUT_MS = 100;
export const MAX_QUEUE_PUBLISH_TIMEOUT_MS = 60000;

function parsePositiveInteger(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || Number.isNaN(parsed) || parsed < 1) {
        return null;
    }
    return parsed;
}

export function resolveQueuePublishRetries(): number {
    const rawValue = process.env.QUEUE_PUBLISH_RETRIES;
    if (!rawValue) {
        return DEFAULT_QUEUE_PUBLISH_RETRIES;
    }

    const parsed = parsePositiveInteger(rawValue);
    if (!parsed) {
        return DEFAULT_QUEUE_PUBLISH_RETRIES;
    }
    if (parsed < MIN_QUEUE_PUBLISH_RETRIES) {
        return MIN_QUEUE_PUBLISH_RETRIES;
    }
    if (parsed > MAX_QUEUE_PUBLISH_RETRIES) {
        return MAX_QUEUE_PUBLISH_RETRIES;
    }

    return parsed;
}

export function resolveQueuePublishTimeoutMs(): number {
    const rawValue = process.env.QUEUE_PUBLISH_TIMEOUT_MS;
    if (!rawValue) {
        return DEFAULT_QUEUE_PUBLISH_TIMEOUT_MS;
    }

    const parsed = parsePositiveInteger(rawValue);
    if (!parsed) {
        return DEFAULT_QUEUE_PUBLISH_TIMEOUT_MS;
    }
    if (parsed < MIN_QUEUE_PUBLISH_TIMEOUT_MS) {
        return MIN_QUEUE_PUBLISH_TIMEOUT_MS;
    }
    if (parsed > MAX_QUEUE_PUBLISH_TIMEOUT_MS) {
        return MAX_QUEUE_PUBLISH_TIMEOUT_MS;
    }

    return parsed;
}

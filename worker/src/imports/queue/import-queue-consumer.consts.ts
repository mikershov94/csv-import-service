export const IMPORT_QUEUE_NAME = 'imports.queue';
export const DEFAULT_QUEUE_CONSUMER_PREFETCH = 10;
export const DEFAULT_QUEUE_CONNECT_RETRIES = 20;
export const DEFAULT_QUEUE_CONNECT_RETRY_DELAY_MS = 1000;

export function resolveQueueConsumerPrefetch(): number {
    const rawValue = process.env.QUEUE_CONSUMER_PREFETCH;
    if (!rawValue) {
        return DEFAULT_QUEUE_CONSUMER_PREFETCH;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        return DEFAULT_QUEUE_CONSUMER_PREFETCH;
    }

    return parsed;
}

export function resolveQueueConnectRetries(): number {
    const rawValue = process.env.QUEUE_CONNECT_RETRIES;
    if (!rawValue) {
        return DEFAULT_QUEUE_CONNECT_RETRIES;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        return DEFAULT_QUEUE_CONNECT_RETRIES;
    }

    return parsed;
}

export function resolveQueueConnectRetryDelayMs(): number {
    const rawValue = process.env.QUEUE_CONNECT_RETRY_DELAY_MS;
    if (!rawValue) {
        return DEFAULT_QUEUE_CONNECT_RETRY_DELAY_MS;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 100) {
        return DEFAULT_QUEUE_CONNECT_RETRY_DELAY_MS;
    }

    return parsed;
}

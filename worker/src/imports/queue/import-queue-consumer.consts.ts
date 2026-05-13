export const IMPORT_QUEUE_NAME = 'imports.queue';
export const DEFAULT_QUEUE_CONSUMER_PREFETCH = 10;

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

import {
    DEFAULT_QUEUE_PUBLISH_RETRIES,
    DEFAULT_QUEUE_PUBLISH_TIMEOUT_MS,
    MAX_QUEUE_PUBLISH_RETRIES,
    MAX_QUEUE_PUBLISH_TIMEOUT_MS,
    resolveQueuePublishRetries,
    resolveQueuePublishTimeoutMs,
} from './import-queue.publisher.consts';

describe('import queue publisher consts', () => {
    const originalRetries = process.env.QUEUE_PUBLISH_RETRIES;
    const originalTimeout = process.env.QUEUE_PUBLISH_TIMEOUT_MS;

    afterEach(() => {
        if (originalRetries === undefined) {
            delete process.env.QUEUE_PUBLISH_RETRIES;
        } else {
            process.env.QUEUE_PUBLISH_RETRIES = originalRetries;
        }

        if (originalTimeout === undefined) {
            delete process.env.QUEUE_PUBLISH_TIMEOUT_MS;
        } else {
            process.env.QUEUE_PUBLISH_TIMEOUT_MS = originalTimeout;
        }
    });

    it('returns defaults for invalid values', () => {
        process.env.QUEUE_PUBLISH_RETRIES = 'abc';
        process.env.QUEUE_PUBLISH_TIMEOUT_MS = 'abc';

        expect(resolveQueuePublishRetries()).toBe(DEFAULT_QUEUE_PUBLISH_RETRIES);
        expect(resolveQueuePublishTimeoutMs()).toBe(DEFAULT_QUEUE_PUBLISH_TIMEOUT_MS);
    });

    it('returns clamped max values', () => {
        process.env.QUEUE_PUBLISH_RETRIES = String(MAX_QUEUE_PUBLISH_RETRIES + 10);
        process.env.QUEUE_PUBLISH_TIMEOUT_MS = String(MAX_QUEUE_PUBLISH_TIMEOUT_MS + 5000);

        expect(resolveQueuePublishRetries()).toBe(MAX_QUEUE_PUBLISH_RETRIES);
        expect(resolveQueuePublishTimeoutMs()).toBe(MAX_QUEUE_PUBLISH_TIMEOUT_MS);
    });
});

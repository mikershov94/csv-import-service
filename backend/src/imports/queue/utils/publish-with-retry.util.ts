import { ConfirmChannel } from 'amqplib';

import { QueuePublishError } from '../import-queue.errors';

export interface PublishWithRetryOptions {
    retries: number;
    timeoutMs: number;
    isRetryableError: (error: unknown) => boolean;
    getChannel: () => Promise<ConfirmChannel>;
    closeConnections: () => Promise<void>;
    queueName: string;
    payload: object;
}

export async function publishWithRetry(options: PublishWithRetryOptions): Promise<void> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < options.retries) {
        try {
            const channel = await options.getChannel();
            const sent = channel.sendToQueue(
                options.queueName,
                Buffer.from(JSON.stringify(options.payload)),
                {
                    persistent: true,
                    contentType: 'application/json',
                },
            );

            if (!sent) {
                throw new QueuePublishError('RabbitMQ временно не принимает сообщения', true);
            }

            await waitForConfirms(channel, options.timeoutMs);
            return;
        } catch (error) {
            lastError = error;
            attempt += 1;
            await options.closeConnections();

            if (attempt >= options.retries || !options.isRetryableError(error)) {
                break;
            }

            await delay(attempt * 100);
        }
    }

    throw toQueuePublishError(lastError);
}

function toQueuePublishError(error: unknown): QueuePublishError {
    if (error instanceof QueuePublishError) {
        return error;
    }
    if (error instanceof Error) {
        return new QueuePublishError(error.message, false);
    }
    return new QueuePublishError('Ошибка публикации в очередь', false);
}

async function waitForConfirms(channel: ConfirmChannel, timeoutMs: number): Promise<void> {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
        await Promise.race([
            channel.waitForConfirms(),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new QueuePublishError('Publish timeout', true)),
                    timeoutMs,
                );
            }),
        ]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

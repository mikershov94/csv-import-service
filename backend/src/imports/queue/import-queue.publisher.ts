import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
    IMPORT_QUEUE_EVENT_VERSION,
    IMPORT_QUEUE_EVENTS,
    ImportChunkEvent,
    ImportJobStartEvent,
    ImportStreamEndEvent,
} from '@shared';
import { ChannelModel, ConfirmChannel, connect } from 'amqplib';

const IMPORT_QUEUE_NAME = 'imports.queue';
const DEFAULT_PUBLISH_RETRIES = 3;
const DEFAULT_PUBLISH_TIMEOUT_MS = 5000;

export class QueuePublishError extends Error {
    constructor(
        message: string,
        public readonly retryable: boolean,
    ) {
        super(message);
        this.name = 'QueuePublishError';
    }
}

@Injectable()
export class ImportQueuePublisher implements OnModuleDestroy {
    private connection?: ChannelModel;
    private channel?: ConfirmChannel;

    async publishJobStart(jobId: string, fileName: string, fileSizeBytes: number): Promise<void> {
        const event: ImportJobStartEvent = {
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.JOB_START,
            jobId,
            fileName,
            fileSizeBytes,
        };
        await this.publish(event);
    }

    async publishChunk(
        jobId: string,
        chunkIndex: number,
        isLast: boolean,
        rows: string[],
    ): Promise<void> {
        const event: ImportChunkEvent = {
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.CHUNK,
            jobId,
            chunkIndex,
            isLast,
            rowsCount: rows.length,
            rows,
        };
        await this.publish(event);
    }

    async publishStreamEnd(jobId: string, totalChunks: number, totalRows: number): Promise<void> {
        const event: ImportStreamEndEvent = {
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.STREAM_END,
            jobId,
            totalChunks,
            totalRows,
        };
        await this.publish(event);
    }

    async onModuleDestroy(): Promise<void> {
        await this.closeConnections();
    }

    private async publish(payload: object): Promise<void> {
        let attempt = 0;
        let lastError: unknown;

        while (attempt < DEFAULT_PUBLISH_RETRIES) {
            try {
                const channel = await this.getOrCreateChannel();
                const sent = channel.sendToQueue(
                    IMPORT_QUEUE_NAME,
                    Buffer.from(JSON.stringify(payload)),
                    {
                        persistent: true,
                        contentType: 'application/json',
                    },
                );

                if (!sent) {
                    throw new QueuePublishError('RabbitMQ временно не принимает сообщения', true);
                }

                await this.waitForConfirms(channel);
                return;
            } catch (error) {
                lastError = error;
                attempt += 1;
                await this.closeConnections();

                if (attempt >= DEFAULT_PUBLISH_RETRIES || !this.isRetryableError(error)) {
                    break;
                }

                await this.delay(attempt * 100);
            }
        }

        throw this.toQueuePublishError(lastError);
    }

    private async getOrCreateChannel(): Promise<ConfirmChannel> {
        if (this.channel) {
            return this.channel;
        }

        const rabbitUrl = process.env.RABBITMQ_URL;
        if (!rabbitUrl) {
            throw new Error('RABBITMQ_URL не задан');
        }

        this.connection = await connect(rabbitUrl);
        this.channel = await this.connection.createConfirmChannel();
        await this.channel.assertQueue(IMPORT_QUEUE_NAME, { durable: true });

        return this.channel;
    }

    private async waitForConfirms(channel: ConfirmChannel): Promise<void> {
        let timeoutId: NodeJS.Timeout | undefined;
        try {
            await Promise.race([
                channel.waitForConfirms(),
                new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(
                        () => reject(new QueuePublishError('Publish timeout', true)),
                        DEFAULT_PUBLISH_TIMEOUT_MS,
                    );
                }),
            ]);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }

    private isRetryableError(error: unknown): boolean {
        if (error instanceof QueuePublishError) {
            return error.retryable;
        }
        return true;
    }

    private toQueuePublishError(error: unknown): QueuePublishError {
        if (error instanceof QueuePublishError) {
            return error;
        }
        if (error instanceof Error) {
            return new QueuePublishError(error.message, false);
        }
        return new QueuePublishError('Ошибка публикации в очередь', false);
    }

    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async closeConnections(): Promise<void> {
        await this.channel?.close();
        await this.connection?.close();
        this.channel = undefined;
        this.connection = undefined;
    }
}

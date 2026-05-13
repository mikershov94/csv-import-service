import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ChannelModel, ConfirmChannel, connect } from 'amqplib';

import {
    IMPORT_QUEUE_NAME,
    resolveQueuePublishRetries,
    resolveQueuePublishTimeoutMs,
} from './consts/import-queue.publisher.consts';
import { QueuePublishError } from './import-queue.errors';
import {
    buildImportChunkEvent,
    buildImportJobStartEvent,
    buildImportStreamEndEvent,
} from './utils/map-import-queue-event.util';
import { publishWithRetry } from './utils/publish-with-retry.util';

@Injectable()
export class ImportQueuePublisher implements OnModuleDestroy {
    private connection?: ChannelModel;
    private channel?: ConfirmChannel;

    async publishJobStart(jobId: string, fileName: string, fileSizeBytes: number): Promise<void> {
        const event = buildImportJobStartEvent(jobId, fileName, fileSizeBytes);
        await this.publish(event);
    }

    async publishChunk(
        jobId: string,
        chunkIndex: number,
        isLast: boolean,
        rows: string[],
    ): Promise<void> {
        const event = buildImportChunkEvent(jobId, chunkIndex, isLast, rows);
        await this.publish(event);
    }

    async publishStreamEnd(jobId: string, totalChunks: number, totalRows: number): Promise<void> {
        const event = buildImportStreamEndEvent(jobId, totalChunks, totalRows);
        await this.publish(event);
    }

    async onModuleDestroy(): Promise<void> {
        await this.closeConnections();
    }

    private async publish(payload: object): Promise<void> {
        await publishWithRetry({
            retries: resolveQueuePublishRetries(),
            timeoutMs: resolveQueuePublishTimeoutMs(),
            isRetryableError: this.isRetryableError,
            getChannel: () => this.getOrCreateChannel(),
            closeConnections: () => this.closeConnections(),
            queueName: IMPORT_QUEUE_NAME,
            payload,
        });
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

    private readonly isRetryableError = (error: unknown): boolean => {
        if (error instanceof QueuePublishError) {
            return error.retryable;
        }
        return true;
    };

    private async closeConnections(): Promise<void> {
        await this.channel?.close();
        await this.connection?.close();
        this.channel = undefined;
        this.connection = undefined;
    }
}

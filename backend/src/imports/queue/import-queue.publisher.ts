import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
    IMPORT_QUEUE_EVENT_VERSION,
    IMPORT_QUEUE_EVENTS,
    ImportChunkEvent,
    ImportJobStartEvent,
    ImportStreamEndEvent,
} from '@shared';
import { Channel, ChannelModel, connect } from 'amqplib';

const IMPORT_QUEUE_NAME = 'imports.queue';

@Injectable()
export class ImportQueuePublisher implements OnModuleDestroy {
    private connection?: ChannelModel;
    private channel?: Channel;

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
            rows,
        };
        await this.publish(event);
    }

    async publishStreamEnd(jobId: string, totalChunks: number): Promise<void> {
        const event: ImportStreamEndEvent = {
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.STREAM_END,
            jobId,
            totalChunks,
        };
        await this.publish(event);
    }

    async onModuleDestroy(): Promise<void> {
        await this.channel?.close();
        await this.connection?.close();
    }

    private async publish(payload: object): Promise<void> {
        const channel = await this.getOrCreateChannel();
        const sent = channel.sendToQueue(IMPORT_QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
            persistent: true,
            contentType: 'application/json',
        });

        if (!sent) {
            throw new Error('RabbitMQ временно не принимает сообщения');
        }
    }

    private async getOrCreateChannel(): Promise<Channel> {
        if (this.channel) {
            return this.channel;
        }

        const rabbitUrl = process.env.RABBITMQ_URL;
        if (!rabbitUrl) {
            throw new Error('RABBITMQ_URL не задан');
        }

        this.connection = await connect(rabbitUrl);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(IMPORT_QUEUE_NAME, { durable: true });

        return this.channel;
    }
}

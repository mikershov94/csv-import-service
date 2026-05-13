import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
    assertNever,
    IMPORT_QUEUE_EVENTS,
    ImportChunkEvent,
    ImportErrorSummaryItem,
    ImportJobStartEvent,
    ImportQueueEvent,
    ImportStreamEndEvent,
} from '@shared';
import { Channel, ChannelModel, connect, ConsumeMessage } from 'amqplib';

import { CarsService } from '../../cars/cars.service';
import { CarUpsertInput } from '../../cars/interfaces/cars.interfaces';
import { ImportsService } from '../imports.service';
import { IMPORT_QUEUE_NAME, resolveQueueConsumerPrefetch } from './import-queue-consumer.consts';
import { parseImportQueueEvent } from './typeguards';
import { parseImportRow } from './utils/parse-import-row.util';

@Injectable()
export class ImportQueueConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ImportQueueConsumer.name);

    private connection?: ChannelModel;
    private channel?: Channel;
    private consumerTag?: string;

    constructor(
        private readonly importsService: ImportsService,
        private readonly carsService: CarsService,
    ) {}

    async onModuleInit(): Promise<void> {
        const rabbitUrl = process.env.RABBITMQ_URL;
        if (!rabbitUrl) {
            this.logger.warn('RABBITMQ_URL не задан, consumer не запущен');
            return;
        }

        this.connection = await connect(rabbitUrl);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(IMPORT_QUEUE_NAME, { durable: true });
        await this.channel.prefetch(resolveQueueConsumerPrefetch());

        const result = await this.channel.consume(
            IMPORT_QUEUE_NAME,
            (message) => {
                void this.handleMessage(message);
            },
            { noAck: false },
        );
        this.consumerTag = result.consumerTag;
        this.logger.log(`Consumer подключен к очереди ${IMPORT_QUEUE_NAME}`);
    }

    async onModuleDestroy(): Promise<void> {
        if (this.channel && this.consumerTag) {
            await this.channel.cancel(this.consumerTag);
        }
        await this.channel?.close();
        await this.connection?.close();
    }

    private async handleMessage(message: ConsumeMessage | null): Promise<void> {
        if (!message || !this.channel) {
            return;
        }

        try {
            const event = this.parseEvent(message.content.toString('utf8'));
            await this.processEvent(event);
            this.channel.ack(message);
        } catch (error) {
            const messageText = error instanceof Error ? error.message : 'unknown error';
            this.logger.error(`Ошибка обработки сообщения очереди: ${messageText}`);
            this.channel.nack(message, false, true);
        }
    }

    private parseEvent(rawPayload: string): ImportQueueEvent {
        return parseImportQueueEvent(rawPayload);
    }

    private async processEvent(event: ImportQueueEvent): Promise<void> {
        switch (event.type) {
            case IMPORT_QUEUE_EVENTS.JOB_START:
                await this.handleJobStart(event);
                return;
            case IMPORT_QUEUE_EVENTS.CHUNK:
                await this.handleChunk(event);
                return;
            case IMPORT_QUEUE_EVENTS.STREAM_END:
                await this.handleStreamEnd(event);
                return;
            default:
                assertNever(event);
        }
    }

    private async handleJobStart(event: ImportJobStartEvent): Promise<void> {
        await this.importsService.markProcessing(event.jobId);
    }

    private async handleChunk(event: ImportChunkEvent): Promise<void> {
        const rowsCount = event.rowsCount ?? event.rows.length;
        const validCars: CarUpsertInput[] = [];
        const errorItems: ImportErrorSummaryItem[] = [];

        for (const row of event.rows) {
            const result = parseImportRow(row);
            if (result.ok) {
                validCars.push(result.car);
                continue;
            }
            errorItems.push(result.error);
        }

        const invalidRowsCount = rowsCount - validCars.length;
        if (validCars.length === 0) {
            await this.importsService.applyProgress(event.jobId, {
                processedRows: rowsCount,
                successRows: 0,
                failedRows: invalidRowsCount,
                insertedCount: 0,
                updatedCount: 0,
                errorItems,
            });
            return;
        }

        try {
            const upsertResult = await this.carsService.bulkUpsertCars(validCars);
            await this.importsService.applyProgress(event.jobId, {
                processedRows: rowsCount,
                successRows: upsertResult.processedCount,
                failedRows: invalidRowsCount,
                insertedCount: upsertResult.insertedCount,
                updatedCount: upsertResult.updatedCount,
                errorItems,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Ошибка при записи автомобилей';
            errorItems.push({
                code: 'CARS_BULK_UPSERT_FAILED',
                message,
                count: validCars.length,
            });

            await this.importsService.applyProgress(event.jobId, {
                processedRows: rowsCount,
                successRows: 0,
                failedRows: rowsCount,
                insertedCount: 0,
                updatedCount: 0,
                errorItems,
            });
        }
    }

    private async handleStreamEnd(event: ImportStreamEndEvent): Promise<void> {
        await this.importsService.markCompleted(event.jobId, false);
    }
}

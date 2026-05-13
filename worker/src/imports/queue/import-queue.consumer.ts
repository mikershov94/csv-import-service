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
import {
    IMPORT_QUEUE_NAME,
    resolveQueueConnectRetries,
    resolveQueueConnectRetryDelayMs,
    resolveQueueConsumerPrefetch,
} from './import-queue-consumer.consts';
import {
    extractJobIdFromPayload,
    InvalidQueueEventPayloadError,
    parseImportQueueEvent,
} from './typeguards';
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

        const retries = resolveQueueConnectRetries();
        const retryDelayMs = resolveQueueConnectRetryDelayMs();

        this.connection = await this.connectWithRetry(rabbitUrl, retries, retryDelayMs);
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

    private async connectWithRetry(
        rabbitUrl: string,
        retries: number,
        retryDelayMs: number,
    ): Promise<ChannelModel> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= retries; attempt += 1) {
            try {
                return await connect(rabbitUrl);
            } catch (error) {
                lastError = error;
                const message = error instanceof Error ? error.message : 'unknown error';
                this.logger.warn(
                    `Не удалось подключиться к RabbitMQ (попытка ${attempt}/${retries}): ${message}`,
                );
                if (attempt < retries) {
                    await this.delay(retryDelayMs);
                }
            }
        }

        throw lastError instanceof Error ? lastError : new Error('Ошибка подключения к RabbitMQ');
    }

    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
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

        const rawPayload = message.content.toString('utf8');
        let parsedEvent: ImportQueueEvent | undefined;

        try {
            const event = this.parseEvent(rawPayload);
            parsedEvent = event;
            await this.processEvent(event);
            this.channel.ack(message);
        } catch (error) {
            const messageText = error instanceof Error ? error.message : 'unknown error';
            this.logger.error(`Ошибка обработки сообщения очереди: ${messageText}`);

            const retryable = this.isRetryableError(error);
            if (retryable) {
                this.channel.nack(message, false, true);
                return;
            }

            const jobId = parsedEvent?.jobId ?? extractJobIdFromPayload(rawPayload);
            if (jobId) {
                await this.markImportFailedSafely(jobId, messageText, 'WORKER_FATAL_ERROR');
            }
            this.channel.nack(message, false, false);
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
        await this.importsService.setTotalRows(event.jobId, event.totalRows);
        await this.waitForProcessingCatchUp(event.jobId, event.totalRows);
        const hasErrors = await this.importsService.hasErrors(event.jobId);
        await this.importsService.markCompleted(event.jobId, hasErrors);
    }

    private async waitForProcessingCatchUp(jobId: string, totalRows: number): Promise<void> {
        const maxAttempts = 40;
        const delayMs = 100;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const processedRows = await this.importsService.getProcessedRows(jobId);
            if (processedRows >= totalRows) {
                return;
            }
            await this.delay(delayMs);
        }

        this.logger.warn(
            `stream_end для ${jobId}: processedRows не достиг totalRows=${totalRows} в отведённое время`,
        );
    }

    private isRetryableError(error: unknown): boolean {
        return !(error instanceof InvalidQueueEventPayloadError);
    }

    private async markImportFailedSafely(
        jobId: string,
        message: string,
        code: string,
    ): Promise<void> {
        try {
            await this.importsService.markFailed(jobId, message, code);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown error';
            this.logger.error(`Не удалось обновить import ${jobId} в failed: ${errorMessage}`);
        }
    }
}

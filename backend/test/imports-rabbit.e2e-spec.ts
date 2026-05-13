import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ImportChunkEvent, ImportQueueEvent, ImportStreamEndEvent } from '@shared';
import { Channel, ChannelModel, connect } from 'amqplib';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';

import { Import, ImportDocument, ImportStatus } from '../src/imports/entities/import.entity';
import { ImportsModule } from '../src/imports/imports.module';

const HEADER = 'vin,make,model,year,mileage,dealershipId,status';
const TEST_MONGO_URI =
    process.env.TEST_MONGODB_URI ??
    'mongodb://admin:Asdqwe123%21@localhost:27017/csv_import_service?authSource=admin';
const TEST_RABBIT_URI = process.env.TEST_RABBITMQ_URL ?? 'amqp://admin:Asdqwe123%21@localhost:5672';
const IMPORT_QUEUE_NAME = 'imports.queue';

describe('Imports RabbitMQ integration (e2e)', () => {
    let app: INestApplication<App>;
    let queueConnection: ChannelModel;
    let queueChannel: Channel;
    let importModel: Model<ImportDocument>;
    let rabbitAvailable = true;

    async function bootstrap(rabbitUrl: string): Promise<void> {
        process.env.MONGODB_URI = TEST_MONGO_URI;
        process.env.RABBITMQ_URL = rabbitUrl;
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [MongooseModule.forRoot(TEST_MONGO_URI), ImportsModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(
            new ValidationPipe({
                transform: true,
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        );
        await app.init();

        importModel = app.get<Model<ImportDocument>>(getModelToken(Import.name));
    }

    function isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    function hasStringField(value: Record<string, unknown>, key: string): boolean {
        return typeof value[key] === 'string';
    }

    function isImportsListBody(value: unknown): value is { items: Array<{ jobId: string }> } {
        if (!isRecord(value) || !Array.isArray(value.items)) {
            return false;
        }

        return value.items.every((item) => isRecord(item) && hasStringField(item, 'jobId'));
    }

    function isImportQueueEvent(value: unknown): value is ImportQueueEvent {
        if (!isRecord(value) || typeof value.type !== 'string' || typeof value.jobId !== 'string') {
            return false;
        }

        if (value.type === 'import.job.start') {
            return typeof value.fileName === 'string' && typeof value.fileSizeBytes === 'number';
        }
        if (value.type === 'import.chunk') {
            return (
                typeof value.chunkIndex === 'number' &&
                typeof value.isLast === 'boolean' &&
                typeof value.rowsCount === 'number' &&
                Array.isArray(value.rows)
            );
        }
        if (value.type === 'import.stream.end') {
            return typeof value.totalChunks === 'number' && typeof value.totalRows === 'number';
        }

        return false;
    }

    function parseQueueEvent(payload: string): ImportQueueEvent {
        const parsed: unknown = JSON.parse(payload);
        if (!isImportQueueEvent(parsed)) {
            throw new Error('Unexpected queue event payload');
        }
        return parsed;
    }

    async function collectQueueMessages(timeoutMs: number): Promise<ImportQueueEvent[]> {
        const startedAt = Date.now();
        const events: ImportQueueEvent[] = [];

        while (Date.now() - startedAt < timeoutMs) {
            const message = await queueChannel.get(IMPORT_QUEUE_NAME, { noAck: false });
            if (!message) {
                await new Promise((resolve) => setTimeout(resolve, 40));
                continue;
            }

            queueChannel.ack(message);
            events.push(parseQueueEvent(message.content.toString('utf8')));
        }

        return events;
    }

    async function postImportWithRetry(
        csvContent: string,
        maxAttempts = 3,
    ): Promise<request.Response> {
        let lastResponse: request.Response | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const response = await request(app.getHttpServer())
                .post('/api/imports')
                .attach('file', Buffer.from(csvContent), {
                    filename: 'cars.csv',
                    contentType: 'text/csv',
                });

            if (response.status === 201) {
                return response;
            }

            lastResponse = response;
            await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }

        throw new Error(
            `POST /api/imports returned ${lastResponse?.status}. Body: ${JSON.stringify(lastResponse?.body)}`,
        );
    }

    function buildCsvWithRows(rowsCount: number): string {
        const rows: string[] = [];
        for (let i = 0; i < rowsCount; i += 1) {
            const vin = `VIN${String(i).padStart(14, '0')}`;
            rows.push(`${vin},BMW,X5,2020,10000,D1,available`);
        }
        return `${HEADER}\n${rows.join('\n')}\n`;
    }

    beforeAll(async () => {
        try {
            queueConnection = await connect(TEST_RABBIT_URI);
            queueChannel = await queueConnection.createChannel();
            await queueChannel.assertQueue(IMPORT_QUEUE_NAME, { durable: true });
        } catch {
            rabbitAvailable = false;
        }
    });

    afterAll(async () => {
        if (queueChannel) {
            await queueChannel.close();
        }
        if (queueConnection) {
            await queueConnection.close();
        }
    });

    afterEach(async () => {
        if (importModel) {
            await importModel.deleteMany({});
        }
        if (queueChannel) {
            await queueChannel.purgeQueue(IMPORT_QUEUE_NAME);
        }
        if (app) {
            await app.close();
        }
    });

    it('POST /api/imports публикует start/chunk/end сообщения в RabbitMQ', async () => {
        if (!rabbitAvailable) {
            throw new Error(
                `RabbitMQ недоступен по ${TEST_RABBIT_URI}. Выполните: docker compose up -d mongodb rabbitmq`,
            );
        }
        await bootstrap(TEST_RABBIT_URI);
        await queueChannel.purgeQueue(IMPORT_QUEUE_NAME);
        await importModel.deleteMany({});

        const response = await postImportWithRetry(buildCsvWithRows(2001));

        if (!isRecord(response.body) || typeof response.body.jobId !== 'string') {
            throw new Error('Response does not contain valid jobId');
        }
        const jobId = response.body.jobId;
        const events = await collectQueueMessages(1200);
        const chunkEvents = events.filter(
            (event): event is ImportChunkEvent => event.type === 'import.chunk',
        );
        let streamEnd: ImportStreamEndEvent | undefined;
        for (const event of events) {
            if (event.type === 'import.stream.end') {
                streamEnd = event;
                break;
            }
        }

        expect(events.length).toBeGreaterThanOrEqual(5);
        expect(events[0].type).toBe('import.job.start');
        expect(events[events.length - 1].type).toBe('import.stream.end');
        expect(events.some((event) => event.jobId === jobId)).toBe(true);
        expect(chunkEvents).toHaveLength(3);
        expect(chunkEvents.map((event) => event.chunkIndex)).toEqual([0, 1, 2]);
        expect(chunkEvents[0].rowsCount).toBe(1000);
        expect(chunkEvents[1].rowsCount).toBe(1000);
        expect(chunkEvents[2].rowsCount).toBe(1);
        expect(streamEnd?.totalChunks).toBe(3);
        expect(streamEnd?.totalRows).toBe(2001);
    });

    it('помечает import как failed, если публикация в RabbitMQ недоступна', async () => {
        if (!rabbitAvailable) {
            throw new Error(
                `RabbitMQ недоступен по ${TEST_RABBIT_URI}. Выполните: docker compose up -d mongodb rabbitmq`,
            );
        }
        await bootstrap('amqp://admin:Asdqwe123%21@localhost:5673');
        await importModel.deleteMany({});

        const createResponse = await request(app.getHttpServer())
            .post('/api/imports')
            .attach('file', Buffer.from('vin,make\nVIN12345678901234,BMW\n'), {
                filename: 'cars.csv',
                contentType: 'text/csv',
            });

        expect(createResponse.status).toBeGreaterThanOrEqual(500);

        const importDoc = await importModel.findOne().sort({ createdAt: -1 }).exec();

        expect(importDoc).not.toBeNull();
        expect(importDoc?.status).toBe(ImportStatus.FAILED);
    });

    it('POST /api/imports сохраняет import, GET /api/imports/:jobId и GET /api/imports возвращают данные', async () => {
        if (!rabbitAvailable) {
            throw new Error(
                `RabbitMQ недоступен по ${TEST_RABBIT_URI}. Выполните: docker compose up -d mongodb rabbitmq`,
            );
        }
        await bootstrap(TEST_RABBIT_URI);
        await queueChannel.purgeQueue(IMPORT_QUEUE_NAME);
        await importModel.deleteMany({});

        const createResponse = await postImportWithRetry(buildCsvWithRows(2));

        if (!isRecord(createResponse.body) || typeof createResponse.body.jobId !== 'string') {
            throw new Error('Response does not contain valid jobId');
        }
        const jobId = createResponse.body.jobId;

        const detailsResponse = await request(app.getHttpServer())
            .get(`/api/imports/${jobId}`)
            .expect(200);
        const detailsBody: unknown = detailsResponse.body;
        if (!isRecord(detailsBody)) {
            throw new Error('Details response body should be an object');
        }
        expect(hasStringField(detailsBody, 'jobId') && detailsBody.jobId).toBe(jobId);
        expect(hasStringField(detailsBody, 'fileName') && detailsBody.fileName).toBe('cars.csv');

        const listResponse = await request(app.getHttpServer()).get('/api/imports').expect(200);
        const listBody: unknown = listResponse.body;
        if (!isImportsListBody(listBody)) {
            throw new Error('List response body should contain items with string jobId');
        }
        expect(listBody.items.some((item) => item.jobId === jobId)).toBe(true);
    });
});
